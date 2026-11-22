const express = require("express"); 

const router = express.Router(); 

const userCtrl = require("../controllers/User"); 

const auth = require("../middleware/auth");


router.post("/onlogin", userCtrl.login);
router.get("/getuser", auth, userCtrl.getUser)
router.post("/updateservice", auth, userCtrl.updateService);
router.post("/addservice", auth, userCtrl.addService);
router.get("/getrecs", auth, userCtrl.getRecs);
router.get("/getaccounts", auth, userCtrl.getAccounts);
router.post("/switchaccount", auth, userCtrl.switchAccount);
router.post("/addaggregator", auth, userCtrl.addAggregator);
router.get("/add", userCtrl.addUser);

module.exports = router;