// Now this here will then expose a function basically. And usually what we do then right away is to pass our secret key right into that. And so that will then give us a Stripe object that we can work with.
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Tour = require('../models/tourModel');
const User = require('../models/userModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');

exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  // 1) Get the currently booked tour
  const tour = await Tour.findById(req.params.tourId);

  // 2) Create checkout session
  const session = await stripe.checkout.sessions.create({
    //--------------------------- THIS PART IS THE INFORMATION ABOUT THE SESSION ITSELF.
    mode: 'payment',
    payment_method_types: ['card'],
    // That is the URL that will get called as soon as a credit card has been successfully charged. So as soon as the purchase was successful the user will be redirected to this URL.
    // success_url: `${req.protocol}://${req.get('host')}/my-tours?tour=${
    //   req.params.tourId
    // }&user=${req.user.id}&price=${tour.price}`,
    success_url: `${req.protocol}://${req.get('host')}/my-tours`,

    cancel_url: `${req.protocol}://${req.get('host')}/tour/${tour.slug}`,
    customer_email: req.user.email,
    // This field is gonna allow us to pass in some data about the session that we create. And that's important because later once the purchase was successful, we will then get access to the session object again. And by then, we want to create a new booking in our database.
    client_reference_id: req.params.tourId,
    //--------------------------- THIS IS THE INFORMATION ABOUT THE PRODUCT THAT THE USER IS ABOUT TO PURCHASE
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: tour.price * 100, // So that is tour.price and now we need to multiply that by 100. Because this amount is expected to be in cents.
          product_data: {
            name: `${tour.name} Tour`,
            description: tour.summary,
            images: [
              `${req.protocol}://www.natours.dev/img/tours/${tour.imageCover}`,
            ],
          },
        },
      },
    ],
  });

  // 3) Create session as response
  res.status(200).json({
    status: 'success',
    session,
  });
});

// exports.createBookingCheckout = catchAsync(async (req, res, next) => {
//   // THIS IS ONLY TEMPORARY, BECAUSE IT IS UNSECURE: everyone can make bookinga without paying but we will implement secure solution when we are in production state
//   const { tour, user, price } = req.query;

//   if (!tour || !user || !price) return next();

//   await Booking.create({ tour, user, price });

//   res.redirect(req.originalUrl.split('?')[0]);
// });

const createBookingCheckout = async (session) => {
  const tour = session.client_reference_id;
  const user = (await User.findOne({ email: session.customer_email })).id;
  const price = session.line_items[0].price_data.unit_amount / 100;
  await Booking.create({ tour, user, price });
};

exports.webhookCheckout = (req, res, next) => {
  const signature = req.header['stripe-signature']; // Basically when Stripe calls our webhook, it will add a header to that request containing a special signature for our webhook.
  // And remember that this body here needs to be in the raw form, so basically available as a string.
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  // Remember that in our Stripe dashboard, that's exactly the type that we defined here. So, that's the event type. Now we're checking if that is really the event that we are receiving here just to be 100% sure. If it is, we then want to actually use the event to create our booking in our database.
  if (event.type === 'checkout.session.completed')
    createBookingCheckout(event.data.object);

  res.status(200).json({ received: true });
};

exports.createBooking = factory.createOne(Booking);
exports.getBooking = factory.getOne(Booking);
exports.getAllBookings = factory.getAll(Booking);
exports.updateBooking = factory.updateOne(Booking);
exports.deleteBooking = factory.deleteOne(Booking);
