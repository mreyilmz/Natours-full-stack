const express = require('express');
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.get('/logout', authController.logout);
router.post('/forgotPassword', authController.forgotPassword);
router.patch('/resetPassword/:token', authController.resetPassword);

// Middleware function'lar sırayla çalıştıkları için, alttaki kod satırından sonra gelecek olan tüm middleware function'larda .protect zorunlu oldu. Bu yüzden sonraki router'lardaki .protect'lere gerek kalmadığı için sildik. Yukarıdaki middleware'lar için .protect kullanmadık.
router.use(authController.protect);

router.patch('/updateMyPassword', authController.updatePassword);
router.get('/me', userController.getMe, userController.getUser);
router.patch(
  '/updateMe',
  userController.uploadUserPhoto,
  userController.resizeUserPhoto,
  userController.updateMe
); // It's single because here we only want to update one single image and then  into single we pass the name of the field that is going to hold the image to upload. And that will be photo. And with field I mean the field in the form that is going to be uploading the image.
router.delete('/deleteMe', userController.deleteMe);

// Bundan middleware functiondan sonraki middleware'larda sadece admin yetkisi istediğimiz için alttaki kodu yazdık.
router.use(authController.restrictTo('admin'));

router
  .route('/')
  .get(userController.getAllUsers)
  .post(userController.createUser);
router
  .route('/:id')
  .get(userController.getUser)
  .patch(userController.updateUser)
  .delete(userController.deleteUser);

module.exports = router;
