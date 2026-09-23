(function(){
  const STORAGE_KEY="apnaFeatureSubjectId";
  function subjectId(){
    try{
      let id=localStorage.getItem(STORAGE_KEY);
      if(!id){id=crypto.randomUUID();localStorage.setItem(STORAGE_KEY,id)}
      return id;
    }catch{return null}
  }
  window.apnaFeatureEnabled=async function(flagKey,environment="production"){
    const key=String(flagKey||"").trim().toLowerCase();
    if(!key)return false;
    let subject=subjectId();
    try{
      const session=await apnaSupabase.auth.getSession();
      subject=session.data?.session?.user?.id||subject;
    }catch{}
    const {data,error}=await apnaSupabase.rpc("get_feature_flag",{p_flag_key:key,p_environment:environment,p_subject_key:subject});
    if(error){console.warn("Feature flag check failed:",error);return false}
    return data===true;
  };
})();