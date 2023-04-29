const express = require('express');
const viewsController = require('../controllers/viewsController');
const authController = require('../controllers/authController');
const bookingController = require('../controllers/bookingController');

const router = express.Router();

router.get(
  '/',
  bookingController.createBookingCheckout,
  authController.isLoggedIn,
  viewsController.getOverview
);
router.get('/tour/:slug', authController.isLoggedIn, viewsController.getTour);
router.get('/login', authController.isLoggedIn, viewsController.getLoginForm);
router.get('/me', authController.protect, viewsController.getAccount);
// router.get('/my-tours', authController.protect, viewsController.getMyTours);

router.post(
  '/submit-user-data',
  authController.protect,
  viewsController.updateUserData
);

module.exports = router;

// router.get('/', (req, res) => {
//   // base'den sonra virgüller ayırarak curly parantez içine variable girebiliyoruz. Pug file'de bunlara locals deniyor.
//   res.status(200).render('base', {
//     tour: 'The Forest Hiker',
//     user: 'Jonas',
//   });
// });
