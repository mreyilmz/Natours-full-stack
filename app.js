const path = require('path'); // Path is a built-in Note module, so a core module, which is used to manipulate path names, basically. So require path, so of course we don't have to install anything. It's just a native built-in module.
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp'); // HTTP Parameter Pollution
const cookieParser = require('cookie-parser'); // Kullanıcıdan cookie'yi okuyabilmek için kullandık. npm i cookie-parser
const bodyParser = require('body-parser');
const compression = require('compression'); // This package gonna compress all our responses. So basically, whenever we send a text response to a client, no matter if that's JSON or HTML code. With the compression package, that text will then be dramatically compressed.
const cors = require('cors'); // CORS = Cross-origin Source Sharing

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const bookingController = require('./controllers/bookingController');
const viewRouter = require('./routes/viewRoutes');

// Further HELMET configuration for Security Policy (CSP)
const scriptSrcUrls = [
  'https://unpkg.com/',
  'https://tile.openstreetmap.org',
  'https://*.stripe.com',
  'https://cdnjs.cloudflare.com/ajax/libs/axios/1.3.5/axios.min.js',
  'https://js.stripe.com',
];
const styleSrcUrls = [
  'https://unpkg.com/',
  'https://tile.openstreetmap.org',
  'https://fonts.googleapis.com/',
];
const connectSrcUrls = ['https://unpkg.com', 'https://tile.openstreetmap.org'];
const fontSrcUrls = ['fonts.googleapis.com', 'fonts.gstatic.com'];

const app = express();

// And the template engine that we're going to use is called "pug". Başka template engineler de var var biz pug kkulanıcaz. Herhangi bişey require etmemize veya indirmemize gerek yok pug zaten express içinde.
app.set('view engine', 'pug'); // npm i pug ile indirdik.
// pug'ların hangi klasör içinde old. belirttik.
app.set('views', path.join(__dirname, 'views'));

////////////////////// 1) GLOBAL MIDDLEWARES
//////////// Implement CORS
app.use(cors()); // What this does is to set the Access-Control-Allow-Origin header to everything. So this was the first part of enabling CORS, but actually that's not all, because right now this will only work for so-called simple requests. And simple requests are get and post requests. On the other hand, we have so-called non-simple requests. And these are put, patch and delete requests, and also requests that send cookies or use nonstandard headers. And these non-simple requests, they require a so-called preflight phase. So whenever there is a non-simple request, the browser will then automatically issue the preflight phase, and this is how that works.

// So before the real request actually happens, and let's say a delete request, the browser first does an options request in order to figure out if the actual request is safe to send. And so what that means for us developers is that on our server we need to actually respond to that options request. And options is really just another HTTP method, so just like get, post or delete, all right? So basically when we get one of these options requests on our server, we then need to send back the same Access-Control-Allow-Origin header. And this way the browser will then know that the actual request, and in this case the delete request, is safe to perform, and then executes the delete request itself.
// So .options is not to set any options on our application, it's really just another HTTP method that we can respond to. In this case we need to respond to it because the browser sends an option request when there is a preflight phase. So we need to define the route for which we want to handle the options.
app.options('*', cors());

//////////// Serving static Files
// app.use(express.static(`${__dirname}/public`));
app.use(express.static(path.join(__dirname, 'public'))); // Yukarıdaki satırla aynı işlevi görüyor fakat bunun slash hatırlama zorunluluğu kendi hallediyor o yüzden daha avantajlı

//////////// Set security HTTP headers
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'", 'http://127.0.0.1:3000/*'],
      connectSrc: ["'self'", ...connectSrcUrls],
      scriptSrc: ["'self'", ...scriptSrcUrls],
      styleSrc: ["'self'", "'unsafe-inline'", ...styleSrcUrls],
      workerSrc: ["'self'", 'blob:'],
      objectSrc: [],
      imgSrc: ["'self'", 'blob:', 'data:', 'https:'],
      fontSrc: ["'self'", ...fontSrcUrls],
      frameSrc: ["'self'", 'https://js.stripe.com'],
    },
  })
);

//////////// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

//////////// Limit requests from same API
// 1 ip'den 1 saatte maksimum 100 request gelebilecek şekilde sınırladık.
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many request from this IP, please try again in an hour',
});
// api ile başlayan tüm route'lara limiter ile sınırlandırma getirdik.
app.use('/api', limiter);

// Basically we're gonna specify a URL here to which Stripe will automatically send a POST request to whenever a checkout session has successfully completed, so basically whenever a payment was successful. With that POST request, Stripe will then send back the original session data that we created in the first step when we created that checkout session. That's the reason why we actually needed our website to be deployed here because now we need to specify that real-life URL here.
// Bu adrese webhook ekledik https://natours-0huh.onrender.com/webhook-checkout ve event olarak da checkout_session_completed seçtik

// Now why do we actually define this webhook-checkout right here in app.js instead of doing it for example in the bookingRouter. The reason for that is that in this handler function, when we receive the body from Stripe, the Stripe function that we're then gonna use to actually read the body needs this body in a raw form, so basically as a string and not as JSON.
// That's the whole reason why we need to use express.raw
app.post(
  '/webhook-checkout',
  express.raw({ type: '*/*' }),
  bookingController.webhookCheckout
);

//////////// Body parser, reaing data from the body into req.body
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' })); // req.body'yi parse'lamak için kullandık, klasik yöntem
app.use(cookieParser()); // Kullanıcıdan cookie'yi okuyabilmek için kullandık. npm i cookie-parser

//////////// Data sanitization against NoSQL query injection
// Data sanitization basically means to clean all the data that comes into the application from malicious code.
app.use(mongoSanitize());

//////////// Data sanitization against XSS
app.use(xss());
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price',
    ],
  })
);

app.use(compression()); // Compression here will return a middleware function which is going to compress all the text that is sent to clients. So it's not going to be working for images because these are usually already compressed.

////////////  Test middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

///////////////////////////////// 3) Routes ////////////////////////////////////////////////////////////////////////////////////////////////////////////

app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);

app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

///// Error Handling middleware
app.use(globalErrorHandler);

///////////////////////////////// 4) Start Server ////////////////////////////////////////////////////////////////////////////////////////////////////////////
module.exports = app;
