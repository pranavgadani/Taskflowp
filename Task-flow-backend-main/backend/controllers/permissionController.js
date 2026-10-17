const Permission = require("../models/Permission");

exports.createPermission = async (req,res)=>{
 try{
   if(!req.body.name)
     return res.status(400).json({msg:"Permission name required"});

   const data = await Permission.create(req.body);
   res.json(data);

 }catch(err){
   res.status(500).json({error:err.message});
 }
};

exports.getPermissions = async (req,res)=>{
 try{
   res.json(await Permission.find());
 }catch(err){
   res.status(500).json({error:err.message});
 }
};

exports.getPermission = async (req,res)=>{
 try{
   res.json(await Permission.findById(req.params.id));
 }catch(err){
   res.status(500).json({error:err.message});
 }
};

exports.updatePermission = async (req,res)=>{
 try{
   res.json(await Permission.findByIdAndUpdate(req.params.id,req.body,{returnDocument:'after'}));
 }catch(err){
   res.status(500).json({error:err.message});
 }
};

exports.deletePermission = async (req,res)=>{
 try{
   await Permission.findByIdAndDelete(req.params.id);
   res.json({msg:"Deleted"});
 }catch(err){
   res.status(500).json({error:err.message});
 }
};