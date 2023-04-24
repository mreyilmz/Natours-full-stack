// MVC konseptine göre modelları models klasörü içinde topladık ve Tour model'ını import ettik.
const sharp = require('sharp');
const multer = require('multer');
const Tour = require('../models/tourModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images', 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

// tour için çoklu image yüklemesi yapacağımız için upload.fields kullanıyoruz. imageCover max 1, images ise max 3 tane olacak.
exports.uploadTourImages = upload.fields([
  { name: 'imageCover', maxCount: 1 },
  { name: 'images', maxCount: 3 },
]);

// upload.single("image") req.file
// upload.array("images", 5) req.files --- 1'den fazla dosya old. için çoğul oldu.
exports.resizeTourImages = catchAsync(async (req, res, next) => {
  if (!req.files.imageCover || !req.files.images) return next();

  // 1) Cover image

  // What's really important to note here is how we put the image filenames on req.body. We do that so that in the next middleware (tourController.updateTour), which is the actual route handler, it will then put that data onto the new document when it updates it.
  req.body.imageCover = `tour-${req.params.id}-${Date.now()}-cover.jpeg`;
  await sharp(req.files.imageCover[0].buffer)
    .resize(2000, 1333)
    .toFormat('jpeg')
    .jpeg({ quality: 90 }) // 90%
    .toFile(`public/img/tours/${req.body.imageCover}`);

  // 2) Images
  req.body.images = [];
  await Promise.all(
    req.files.images.map(async (file, index) => {
      const filename = `tour-${req.params.id}-${Date.now()}-${index + 1}.jpeg`;

      await sharp(file.buffer)
        .resize(2000, 1333)
        .toFormat('jpeg')
        .jpeg({ quality: 90 }) // 90%
        .toFile(`public/img/tours/${filename}`);
      // What's really important to note here is how we put the image filenames on req.body. We do that so that in the next middleware (tourController.updateTour), which is the actual route handler, it will then put that data onto the new document when it updates it.
      req.body.images.push(filename);
    })
  );
  next();
});

exports.aliasTopTours = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'name,price,ratingsAverage,summary,difficulty';
  next();
};

exports.getAllTours = factory.getAll(Tour);
exports.getTour = factory.getOne(Tour, { path: 'reviews' });
exports.createTour = factory.createOne(Tour);
exports.updateTour = factory.updateOne(Tour);
exports.deleteTour = factory.deleteOne(Tour);

exports.getTourStats = catchAsync(async (req, res, next) => {
  // aggregate objecti döndürür.
  const stats = await Tour.aggregate([
    {
      $match: { ratingsAverage: { $gte: 4.5 } },
    },
    {
      $group: {
        _id: { $toUpper: '$difficulty' },
        numTours: { $sum: 1 },
        numRatings: { $sum: '$ratingsQuantity' },
        avgRating: { $avg: '$ratingsAverage' },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
    {
      $sort: { avgPrice: -1 },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      stats,
    },
  });
});

exports.getMonthlyPlan = catchAsync(async (req, res, next) => {
  const year = req.params.year * 1;
  const plan = await Tour.aggregate([
    {
      $unwind: '$startDates',
    },
    {
      $match: {
        startDates: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    {
      $group: {
        _id: { $month: '$startDates' },
        numTourStarts: { $sum: 1 },
        tours: { $push: '$name' },
      },
    },
    {
      $addFields: { month: '$_id' },
    },
    {
      $project: {
        _id: 0,
      },
    },
    {
      $sort: { numTourStarts: -1 },
    },
    {
      $limit: 12,
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      plan,
    },
  });
});

// /tours-within/:distance/center/:latlng/unit/:unit
// /tours-within/233/center/-40,45/unit/mi
exports.getToursWithin = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  // Geospatial queryi kullanabilmek için belli bir noktada oluşturacağımız küre'nin yarı çapını belirtmemiz gerekiyor. Bunu da mesafemizi radyana çevirerek yapabiliyoruz. Mil ise 3963.2'ye değilse Kilometre cinsinden olan 6378.1'e böldük.
  const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1;

  if (!lat || !lng)
    return next(
      new AppError(
        'Please provide latitude longitude in the format lat,lng',
        400
      )
    );

  const tours = await Tour.find({
    // Geospatial'i bu şekilde kullanıyoruz. Genelde lat öncedir burda lng önce geliyor. Bu kürenin içindeki tour'ları seçmiş olduk
    startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } },
  });

  res.status(200).json({
    status: 'success',
    results: tours.length,
    data: {
      data: tours,
    },
  });
});

exports.getDistances = catchAsync(async (req, res, next) => {
  const { latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  const multiplier = unit === 'mi' ? 0.000621371 : 0.001; // Metrenin km'ye ve mil' dönüşümü

  if (!lat || !lng)
    return next(
      new AppError(
        'Please provide latitude longitude in the format lat,lng',
        400
      )
    );

  const distances = await Tour.aggregate([
    {
      // This is the only geospatial aggregation pipeline stage that actually exists. This one always needs to be the first one in the pipeline. Something else that's also very important to note about geoNear is that it requires that at least one of our fields contains a geospatial index. Actually we already did that before. Our start location already has this 2dsphere geospatial index on it. But if you have multiple fields with geospatial indexes then you need to use the keys parameter in order to define the field that you want to use for calculations. So keep that in mind, but again, in this case we only have one field, and so automatically that startLocation field is going to be used for doing these calculations.
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [lng * 1, lat * 1], // 1 ile çarparak sayıya çevirdk.
        },
        distanceField: 'distance',
        distanceMultiplier: multiplier, // Mesafeler metre cinsinden olduuğu için distanceMultiplier kullanarak km değeri veya mil değeri ile çarptık ve kilometre'ye dönüştürdük.
      },
    },
    {
      // Diğer field'ların gözükmemesi için $project'i kullandık. Sadce distance ve tour'un ismi gözükecek.
      $project: {
        distance: 1,
        name: 1,
      },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      data: distances,
    },
  });
});
