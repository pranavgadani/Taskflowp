const Role = require("../models/Role");
const Permission = require("../models/Permission");

exports.createRole = async (req,res)=>{
 try{
   if(!req.body.name)
     return res.status(400).json({msg:"Role name required"});

   // Validate permissions if provided
   if (req.body.permissions && req.body.permissions.length > 0) {
     for (const perm of req.body.permissions) {
       if (perm.value) {
         const exists = await Permission.findOne({ value: perm.value });
         if (!exists) {
           return res.status(400).json({msg: `Invalid permission value: ${perm.value}`});
         }
       }
     }
   }
    const isSuperAdmin = req.user.email === (process.env.SUPERADMIN_EMAIL || "gadanipranav@gmail.com") || req.user.role?.name === "Super Admin";
    const roleData = { ...req.body };
    let companyId = req.user.companyId?._id || req.user.companyId;

    if (isSuperAdmin && !companyId) {
      companyId = req.body.companyId || req.query.companyId;
    }

    if (companyId) {
      roleData.companyId = companyId;
    }

    const data = await Role.create(roleData);
   
   // LOG: Show created role permissions in console
   console.log(`=== ROLE CREATED: ${data.name} ===`);
   console.log(`Permissions assigned:`, data.permissions.map(p => ({
     name: p.name,
     value: p.value,
     all: p.all,
     create: p.create,
     read: p.read,
     update: p.update,
     delete: p.delete
   })));
   
   res.json(data);

 }catch(err){
   res.status(500).json({error:err.message});
 }
};

exports.getRoles = async (req,res)=>{
  try{
    const isSuperAdmin = req.user.email === "gadanipranav@gmail.com" || req.user.role?.name === "Super Admin";
    let query = {};
    if (!isSuperAdmin) {
      query.companyId = req.user.companyId?._id || req.user.companyId;
    } else if (req.query.companyId) {
      query.companyId = req.query.companyId;
    }
    const data = await Role.find(query);
    res.json(data);

 }catch(err){
   res.status(500).json({error:err.message});
 }
};

exports.getRole = async (req,res)=>{
 try{
   const data = await Role.findById(req.params.id);
   if (!data) {
     return res.status(404).json({msg: "Role not found"});
   }
   res.json(data);
 }catch(err){
   res.status(500).json({error:err.message});
 }
};

exports.updateRole = async (req,res)=>{
 try{
   // LOG: Show what we're receiving
   console.log(`=== ROLE UPDATE REQUEST ===`);
   console.log(`Role ID: ${req.params.id}`);
   console.log(`Request body:`, JSON.stringify(req.body, null, 2));
   
   // Validate permissions if provided
   if (req.body.permissions && req.body.permissions.length > 0) {
     for (const perm of req.body.permissions) {
       console.log(`Validating permission:`, perm);
       
       // Handle both old format (permissionId) and new format (name/value)
       if (perm.value) {
         // New format - validate by value
         const exists = await Permission.findOne({ value: perm.value });
         if (!exists) {
           console.log(`❌ Invalid permission value: ${perm.value}`);
           return res.status(400).json({msg: `Invalid permission value: ${perm.value}`});
         }
         console.log(`✅ Permission found: ${exists.name}`);
       } else if (perm.permissionId) {
         // Old format - validate by ID
         const exists = await Permission.findById(perm.permissionId);
         if (!exists) {
           console.log(`❌ Invalid permission ID: ${perm.permissionId}`);
           return res.status(400).json({msg: `Invalid permission ID: ${perm.permissionId}`});
         }
         console.log(`✅ Permission found: ${exists.name}`);
       }
     }
   }

   const data = await Role.findByIdAndUpdate(
     req.params.id,
     req.body,
     {returnDocument:'after', runValidators: true}
   );
   
   if (!data) {
     return res.status(404).json({msg: "Role not found"});
   }
   
   // LOG: Show updated role permissions in console
   console.log(`=== ROLE UPDATED: ${data.name} ===`);
   console.log(`Permissions assigned:`, data.permissions.map(p => ({
     name: p.name,
     value: p.value,
     all: p.all,
     create: p.create,
     read: p.read,
     update: p.update,
     delete: p.delete
   })));
   
   res.json(data);
 }catch(err){
   res.status(500).json({error:err.message});
 }
};

exports.deleteRole = async (req,res)=>{
 try{
   await Role.findByIdAndDelete(req.params.id);
   res.json({msg:"Deleted"});
 }catch(err){
   res.status(500).json({error:err.message});
 }
};