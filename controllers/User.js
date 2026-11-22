const User = require("../models/User"); 
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt"); 
const { JWT_SECRET } = require("../middleware/auth");

// Champs renvoyés pour la liste des comptes (jamais les codes PIN ni le mot de passe).
const ACCOUNT_FIELDS = {name: 1, phone: 1, services: 1, parent_id: 1, active: 1, street: 1, date: 1, status: 1};

// Comptes accessibles depuis un compte principal : lui-même puis les agrégateurs qu'il a créés.
const accountsOf = async (ownerId) => {

    const owner = await User.findOne({_id: ownerId}, ACCOUNT_FIELDS);

    if(!owner || owner.status !== "agg" || owner.parent_id) return owner ? [owner] : [];

    const children = await User.find({parent_id: ownerId.toString(), status: "agg"}, ACCOUNT_FIELDS).sort({date: 1});

    return [owner, ...children];
};


exports.login = (req, res) => {
  
    console.log(req.body);
  
    User.findOne({phone: req.body.phone}).then((user) => {
      
      console.log(user);
      
      if(!user || (user && !user.active)){
        
        res.status(200).json({status: 1, message: "Utilisateur non trouvé ou désactivé"}); 
        
          
      }else{
          
       
        bcrypt.compare( req.body.password, user.password).then((valid) => {
          
            if(valid){
              
         
              
              User.aggregate([
                {
                  $match: {
                     $or:[{agg_id: user._id.toString()}, {rec_id: user._id.toString()}]
                  }
                }, 
                
                {
                  $facet: {
                    "recouvreurs" : [
                      {
                        $match: {
                          status: "rec"
                        }
                      }, 
                      {
                        $count: "totalRecs"
                      }
                    ], 
                    "pos" : [
                      {
                        $match: {
                          status: "pos"
                        }
                      }, 
                      {
                        $count: "totalPos"
                      }
                    ]
                  }
                }
              ]).then((result) => {
                
                console.log(result[0])
                
                user.pos = result[0].pos.length > 0 ? result[0].pos[0].totalPos : 0; 
                user.recouvreurs = result[0].recouvreurs.length > 0 ? result[0].recouvreurs[0].totalRecs : 0; 

               // Un agrégateur principal qui a créé d'autres comptes choisit ensuite celui dans lequel il travaille.
               return accountsOf(user._id).then((accounts) => {
                  
               res.status(201).json({status: 0, message: "Connexion effectuée avec succès", token: jwt.sign(
                {userId: user._id}, 
                 JWT_SECRET
                
          ),user, accounts: accounts.length > 1 ? accounts : []});

               });
              
              }).catch((err) => {
    
                  res.status(505).json({err})
              })
              
               
                
            }else{
              
                res.status(200).json({status: 1, message: "Mot de passe incorrect"})
            }
        })
        
      }
        
    }, (err) => {
    
      res.status(505).json({err})
  })
}

exports.addUser = async (req, res) => {

    let pass = await bcrypt.hash("2580", 10);

    const newUser = new User({

        name: "Fof Services Plus", 
        phone: "074761202", 
        password: pass
    })

    await newUser.save(); 

    res.status(200).json({status: 0})
}

exports.updateService = async (req, res) => {
  
    let champ; 
  
    console.log(req.body)
  
    if(req.body.service == "am"){
      
      if(req.body.services.find(item => item == 'am') == "am"){
        
       const hash = await bcrypt.hash(req.body.password, 10); 
        
          champ = {amPin: req.body.password, password: hash}
            
     
          
      }else{
        
         champ = {amPin: req.body.password}
          
      }
      
     
    
    }else if(req.body.service == "mm"){
      
       if(req.body.services.find(item => item == "mm") == "mm"){
        
        const hash = await bcrypt.hash(req.body.password, 10); 
          
          champ = {mmPin: req.body.password, password: hash}
            
   
          
      }else{
        
         champ = {amPin: req.body.password}
          
      }
    
    }else if(req.body.service === "flash"){
      
      champ = {flashPin: req.body.password}
    
    }else if(req.body.service === "express"){
      
      champ = {expressPin: req.body.password}
    
    }
  
    User.updateOne({_id: req.auth.userId}, {$set: champ}).then(async () => {
      
      const uss = await User.findOne({_id: req.auth.userId}); 
        
      res.status(201).json({status: 0, message: "Changement effectué avec succès", user:  {name: uss.name, amPhone: uss.amPhone, amPin: uss.amPin, mmPhone: uss.mmPhone, mmPin: uss.mmPin, services: uss.services} }); 
      
      
      
    }, (err) => {
      
        res.status(505).json({err})
    })
}


exports.addService = async (req, res) => {
  
   const user =  await User.findOne({_id: req.auth.userId}); 
  
  console.log(user);
  
  let services = user.services
  
    let update = {}; 
  
    if(req.body.amPhone){
        
        services = [...services, "am"];
        update = {...update, amPhone: req.body.amPhone, amPin: req.body.amPin, services}; 
        
    }
  
     if(req.body.mmPhone){
       
       
        services = [...services, "mm"];
        update = {...update, mmPhone: req.body.mmPhone, mmPin: req.body.mmPin, services}
        
    }
  
     if(req.body.flashPhone){
        
        services = [...services, "flash"];
        update = {...update, flashPhone: req.body.flashPhone, flashPin: req.body.flashPin, services}; 
       
    }
  
   if(req.body.expressPhone){
      
         services = [...services, "express"];
        update = {...update, expressPhone: req.body.expressPhone, expressPin: req.body.expressPin, services}; 
        
    }
  
  User.updateOne({_id: req.auth.userId}, {$set: update}).then(async () => {
    
    const user = await User.findOne({_id: req.auth.userId}); 
    delete user._id
    
    res.status(201).json({status: 0, message: "Modification effectuée avec succès", user});
      
  }, (err) => {
    
      res.status(505).json({err})
  })
  
    
  
  
}



exports.getRecs = (req, res) => {
  
  User.find({agg_id: req.auth.userId, status: "rec"}).then((data) => {
    
      
        res.status(200).json({status: 0, recs: data})
    
    
    
  }, (err) => {
    
    
      console.log(err); 
      res.status(505).json({err});
  })
}


exports.getUser = (req, res) => {
  
    //, user: {name: uss.name, amPhone: uss.amPhone, amPin: uss.amPin, mmPhone: uss.mmPhone, mmPin: uss.mmPin, services: uss.services}
  
  
  
  
    User.aggregate([
      
      

      {
        $facet: {
          'user': [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", {$toObjectId: req.auth.userId}]
                }
              }
            }
          ], 
          "recs": [
            {
              $match :{
                $and : [
                  {agg_id: req.auth.userId}, 
                  {status: "rec"}
                ]
              }
            }, 
            {
              $count: "totalRecs"
            }
          ], 
          "pos": [
            {
              $match :{
                $and : [
                  {$or:[{agg_id: req.auth.userId}, {rec_id: req.auth.userId}]}, 
                  {status: "pos"}
                ]
              }
            }, 
             {
              $count: "totalPos"
            }
          ]
        }
      }
    ]).then((result) => {
      
             // delete uss._id;
      
      console.log(result[0]);
      const user = result[0].user[0]; 
      user.recouvreurs = result[0].recs.length > 0 ? result[0].recs[0].totalRecs : 0
      user.pos = result[0].pos.length > 0 ? result[0].pos[0].totalPos : 0
      // Compte principal de la session : l'app propose « Changer de compte » quand il en existe plusieurs.
      user.ownerId = req.auth.ownerId
      
    
      
        res.status(200).json({status: 0, user})
        
    }, (err) => {
      
        res.status(505).json({err})
    })
  

}


// Liste des comptes agrégateur accessibles depuis la session (compte principal + comptes qu'il a créés).
exports.getAccounts = async (req, res) => {

    try {

        const accounts = await accountsOf(req.auth.ownerId);

        res.status(200).json({status: 0, accounts, currentId: req.auth.userId, ownerId: req.auth.ownerId});

    } catch (err) {

        console.log(err);
        res.status(505).json({err: err.message});
    }
};

// Entre dans un des comptes : le nouveau jeton porte ce compte (userId), tout ce qui suit lui est rattaché
// (recouvreurs, points, commandes, retours, SMS), et garde le compte principal (ownerId) pour pouvoir revenir.
exports.switchAccount = async (req, res) => {

    try {

        const ownerId = req.auth.ownerId;
        const accounts = await accountsOf(ownerId);
        const target = accounts.find(account => account._id.toString() === String(req.body._id));

        if(!target){

            return res.status(200).json({status: 1, message: "Ce compte n'est pas rattaché au vôtre"});
        }

        if(!target.active){

            return res.status(200).json({status: 1, message: "Ce compte est désactivé"});
        }

        const payload = target._id.toString() === ownerId.toString()
            ? {userId: target._id}
            : {userId: target._id, ownerId};

        res.status(200).json({status: 0, token: jwt.sign(payload, JWT_SECRET), account: target});

    } catch (err) {

        console.log(err);
        res.status(505).json({err: err.message});
    }
};

// Le compte agrégateur principal crée un autre compte agrégateur, qui aura ses propres SIM, recouvreurs et points.
exports.addAggregator = async (req, res) => {

    try {

        const owner = await User.findOne({_id: req.auth.ownerId});

        if(!owner || owner.status !== "agg" || owner.parent_id){

            return res.status(200).json({status: 1, message: "Seul le compte agrégateur principal peut créer un compte"});
        }

        const name = (req.body.name || "").trim();
        const phone = (req.body.phone || "").trim();

        if(!name || !/^\d{9}$/.test(phone) || !req.body.password || String(req.body.password).length < 4){

            return res.status(200).json({status: 1, message: "Nom, numéro (9 chiffres) et mot de passe (4 caractères minimum) obligatoires"});
        }

        const existing = await User.findOne({phone});

        if(existing){

            return res.status(200).json({status: 1, message: "Numéro de téléphone déjà enregistré"});
        }

        const account = await User.create({
            name,
            phone,
            street: req.body.street,
            password: await bcrypt.hash(String(req.body.password), 10),
            status: "agg",
            parent_id: owner._id.toString(),
            services: [],
            active: true,
            date: new Date()
        });

        res.status(201).json({status: 0, message: "Compte agrégateur créé avec succès", account: {_id: account._id, name: account.name, phone: account.phone, services: [], parent_id: account.parent_id, active: true, status: "agg"}});

    } catch (err) {

        console.log(err);
        res.status(505).json({err: err.message});
    }
};
