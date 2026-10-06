const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const sourcePath = path.join(__dirname, "..", "admin-product.js");
const bootstrap = '$("form").addEventListener("submit",async e=>{e.preventDefault();await saveProduct()});boot();';
const source = fs.readFileSync(sourcePath, "utf8");
assert.ok(source.includes(bootstrap), "test harness expects the page bootstrap to remain explicit");
const testableSource = source.replace(bootstrap, "");

function createHarness(initialImages = []) {
  const state = {
    images: initialImages.map((image) => ({ ...image })),
    objects: new Set(initialImages.map((image) => image.storage_path)),
    rpcCalls: [],
    storageRemovals: [],
    nextImageId: 1,
    confirmResult: true,
  };

  const variantSelect = { value: "" };
  const elements = new Map();
  const getElement = (id) => {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        innerHTML: "",
        textContent: "",
        className: "",
        value: id === "name" ? "Test product" : "",
        hidden: false,
        disabled: false,
        offsetTop: 0,
        querySelectorAll(selector) {
          return id === "imageList" && selector === ".image-variant" ? [variantSelect] : [];
        },
      });
    }
    return elements.get(id);
  };

  function queryFor(table) {
    let operation = "select";
    let payload = null;
    const filters = [];
    const orders = [];
    let limit = null;

    const execute = () => {
      if (table !== "product_images") return { data: [], error: null };
      let matching = state.images.filter((row) =>
        filters.every(([key, value]) => row[key] === value),
      );

      if (operation === "select") {
        matching = [...matching].sort((left, right) => {
          for (const [column, options] of orders) {
            const direction = options.ascending === false ? -1 : 1;
            const a = left[column] ?? "";
            const b = right[column] ?? "";
            if (a < b) return -1 * direction;
            if (a > b) return 1 * direction;
          }
          return 0;
        });
        if (limit !== null) matching = matching.slice(0, limit);
        return { data: matching.map((row) => ({ ...row })), error: null };
      }

      if (operation === "update") {
        for (const row of matching) Object.assign(row, payload);
        return { data: matching.map((row) => ({ ...row })), error: null };
      }

      if (operation === "delete") {
        const removed = new Set(matching.map((row) => row.id));
        state.images = state.images.filter((row) => !removed.has(row.id));
        return { data: matching, error: null };
      }

      return { data: [], error: null };
    };

    const query = {
      select() { operation = "select"; return query; },
      eq(key, value) { filters.push([key, value]); return query; },
      order(column, options = {}) { orders.push([column, options]); return query; },
      limit(value) { limit = value; return query; },
      update(value) { operation = "update"; payload = value; return query; },
      delete() { operation = "delete"; return query; },
      insert(value) {
        const row = {
          id: `new-image-${state.nextImageId++}`,
          created_at: new Date().toISOString(),
          ...value,
        };
        state.images.push(row);
        return Promise.resolve({ data: row, error: null });
      },
      then(resolve, reject) {
        return Promise.resolve().then(execute).then(resolve, reject);
      },
    };
    return query;
  }

  const supabase = {
    from(table) { return queryFor(table); },
    storage: {
      from(bucket) {
        assert.equal(bucket, "product-images");
        return {
          async upload(storagePath) {
            state.objects.add(storagePath);
            return { data: { path: storagePath }, error: null };
          },
          async remove(paths) {
            state.storageRemovals.push([...paths]);
            for (const storagePath of paths) state.objects.delete(storagePath);
            return { data: [], error: null };
          },
          getPublicUrl(storagePath) {
            return { data: { publicUrl: `https://storage.invalid/${storagePath}` } };
          },
        };
      },
    },
    async rpc(name, args) {
      state.rpcCalls.push({ name, args });
      if (name === "admin_set_product_primary_image") {
        const rows = state.images.filter((row) => row.product_id === args.p_product_id);
        const target = rows.find((row) => row.id === args.p_image_id);
        if (!target) return { data: null, error: new Error("Image does not belong to this product") };
        for (const row of rows) row.is_primary = false;
        target.is_primary = true;
        return { data: true, error: null };
      }
      if (name === "admin_reorder_product_images") {
        const rows = state.images.filter((row) => row.product_id === args.p_product_id);
        if (rows.length !== args.p_image_ids.length) {
          return { data: null, error: new Error("Incomplete image order") };
        }
        for (const [index, id] of args.p_image_ids.entries()) {
          const row = rows.find((candidate) => candidate.id === id);
          if (!row) return { data: null, error: new Error("Unknown image") };
          row.sort_order = index;
        }
        return { data: rows.length, error: null };
      }
      return { data: null, error: new Error(`Unexpected RPC: ${name}`) };
    },
  };

  const context = vm.createContext({
    URLSearchParams,
    location: { search: "" },
    document: {
      getElementById: getElement,
      querySelectorAll: () => [],
    },
    window: { scrollTo() {} },
    apnaSupabase: supabase,
    crypto: { randomUUID: () => `test-uuid-${state.nextImageId}` },
    confirm: () => state.confirmResult,
    console,
  });
  vm.runInContext(testableSource, context, { filename: "admin-product.js" });
  vm.runInContext(
    'editId = "product-1"; productOwnerId = "admin-1"; user = { id: "admin-1" }; imageRows = __initialImages;',
    Object.assign(context, { __initialImages: state.images }),
  );

  return {
    context,
    state,
    variantSelect,
    evaluate(expression) { return vm.runInContext(expression, context); },
  };
}

test("file validation accepts supported images and rejects invalid/oversize files", () => {
  const harness = createHarness();
  const validate = (file) => {
    harness.context.__file = file;
    return harness.evaluate("validateFile(__file)");
  };

  assert.equal(validate({ type: "image/jpeg", size: 1 }), "");
  assert.equal(validate({ type: "image/png", size: 5 * 1024 * 1024 }), "");
  assert.equal(validate({ type: "image/webp", size: 1 }), "");
  assert.match(validate({ type: "image/gif", size: 1 }), /Only JPG, PNG or WebP/);
  assert.match(validate({ type: "image/png", size: 5 * 1024 * 1024 + 1 }), /5 MB/);
  assert.match(validate({ type: "image/png", size: 0 }), /empty or unreadable/);
});

test("sequential uploads assign one primary and persistent zero-based order", async () => {
  const harness = createHarness();
  await harness.evaluate('uploadPreparedImage({ file: { name: "front.webp" } })');
  await harness.evaluate('uploadPreparedImage({ file: { name: "side.webp" } }, "variant-1")');

  assert.equal(harness.state.images.length, 2);
  assert.equal(harness.state.images[0].is_primary, true);
  assert.equal(harness.state.images[1].is_primary, false);
  assert.deepEqual(harness.state.images.map((image) => image.sort_order), [0, 1]);
  assert.equal(harness.state.images[1].variant_id, "variant-1");
  assert.equal(harness.state.objects.size, 2);
});

test("drag/drop reordering persists a normalized order through the admin RPC", async () => {
  const harness = createHarness([
    { id: "image-a", product_id: "product-1", storage_path: "a.webp", sort_order: 0, is_primary: true },
    { id: "image-b", product_id: "product-1", storage_path: "b.webp", sort_order: 1, is_primary: false },
    { id: "image-c", product_id: "product-1", storage_path: "c.webp", sort_order: 4, is_primary: false },
  ]);

  assert.equal(await harness.evaluate('reorderTo("image-c", "image-a")'), true);
  const ordered = [...harness.state.images].sort((a, b) => a.sort_order - b.sort_order);
  assert.deepEqual(ordered.map((image) => image.id), ["image-c", "image-a", "image-b"]);
  assert.deepEqual(ordered.map((image) => image.sort_order), [0, 1, 2]);
  assert.equal(harness.state.rpcCalls[0].name, "admin_reorder_product_images");
});

test("variant selection persists variant_id on the image record", async () => {
  const harness = createHarness([
    { id: "image-a", product_id: "product-1", storage_path: "a.webp", sort_order: 0, is_primary: true, variant_id: null },
  ]);
  harness.variantSelect.value = "variant-9";

  harness.evaluate("renderImages()");
  await harness.variantSelect.onchange();

  assert.equal(harness.state.images[0].variant_id, "variant-9");
});

test("confirmed primary-image deletion cleans Storage, sets a fallback, and normalizes order", async () => {
  const harness = createHarness([
    { id: "image-primary", product_id: "product-1", storage_path: "primary.webp", sort_order: 2, is_primary: true },
    { id: "image-next", product_id: "product-1", storage_path: "next.webp", sort_order: 9, is_primary: false },
  ]);

  assert.equal(await harness.evaluate('deleteImage("image-primary")'), true);
  assert.equal(harness.state.objects.has("primary.webp"), false);
  assert.deepEqual(harness.state.storageRemovals, [["primary.webp"]]);
  assert.equal(harness.state.images.length, 1);
  assert.equal(harness.state.images[0].id, "image-next");
  assert.equal(harness.state.images[0].is_primary, true);
  assert.equal(harness.state.images[0].sort_order, 0);
  assert.deepEqual(harness.state.rpcCalls.map((call) => call.name), [
    "admin_set_product_primary_image",
    "admin_reorder_product_images",
  ]);
});

test("cancelled delete confirmation leaves the image and Storage object intact", async () => {
  const harness = createHarness([
    { id: "image-a", product_id: "product-1", storage_path: "a.webp", sort_order: 0, is_primary: true },
  ]);
  harness.state.confirmResult = false;

  assert.equal(await harness.evaluate('deleteImage("image-a")'), false);
  assert.equal(harness.state.images.length, 1);
  assert.equal(harness.state.objects.has("a.webp"), true);
  assert.deepEqual(harness.state.storageRemovals, []);
});

test("database migration and page retain admin-only write authorization", () => {
  const migration = fs.readFileSync(
    path.join(__dirname, "..", "supabase", "migrations", "20261006120000_phase5_admin_only_product_images.sql"),
    "utf8",
  );
  assert.match(source, /p\.role!=="admin"/);
  assert.match(migration, /CREATE POLICY product_images_admin_insert[\s\S]*?private\.is_admin\(\)/);
  assert.match(migration, /CREATE POLICY product_images_upload[\s\S]*?private\.is_admin\(\)/);
  assert.doesNotMatch(migration, /private\.is_seller\(\)/);
  assert.doesNotMatch(migration, /service.role|service_role_key/i);

  const productSource = fs.readFileSync(path.join(__dirname, "..", "product.js"), "utf8");
  assert.ok(productSource.includes("specific.length?specific:general.length?general:images||[]"));
  assert.ok(productSource.includes('.order("is_primary",{ascending:false}).order("sort_order")'));
});
