const path = require('path'); // Path is a built-in Note module, so a core module, which is used to manipulate path names, basically. So require path, so of course we don't have to install anything. It's just a native built-in module.
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp'); // HTTP Parameter Pollution
const cookieParser = require('cookie-parser'); // Kullanıcıdan cookie'yi okuyabilmek için kullandık. npm i cookie-parser
const compression = require('compression'); // This package gonna compress all our responses. So basically, whenever we send a text response to a client, no matter if that's JSON or HTML code. With the compression package, that text will then be dramatically compressed.

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const viewRouter = require('./routes/viewRoutes');
const bookingRouter = require('./routes/bookingRoutes');

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
