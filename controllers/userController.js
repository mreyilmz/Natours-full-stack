const User = require('../models/userModel');
const sharp = require('sharp'); // Sharp is a really nice and easy to use image processing library for Node Js and there's fairly a lot of stuff that we can do with it.
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');
const multer = require('multer'); // npm i multer. Multer is a very popular middleware to handle multi-part form data, which is a form in coding that's used to upload files from a form.

// We are going to create one Multer storage and one Multer filter. And then we're going to use that storage and the filter to create the upload from there.
/* const multerStorage = multer.diskStorage({
  // This callback function has access to the current request, to the currently uploaded file, and also to a callback function. And this callback function is a bit like the next function in Express. But it's similar in that we can pass errors in here and other stuff.
  // So callback, and then the first argument is an error if there is one. And if not, then just null. And the second argument is then the actual destination.
  destination: (req, file, cb) => {
    cb(null, 'public/img/users');
  },
  // And now we want to give our files some unique filenames. And the way I'm going to do that is to call them user-userid-currenttimestamp.
  // user-77fsdf548df-35445413.jpeg
  filename: (req, file, cb) => {
    const ext = file.mimetype.split('/')[1];
    //  That's the ID from the currently logged in user.
    cb(null, `user-${req.user.id}-${Date.now()}.${ext}`);
  },
});
*/

// Now, when doing image processing like this right after uploading a file, then it's always best to not even save the file to the disk, but instead save it to memory. This way the image will then be stored as a buffer. And so that buffer is then available at req.file.buffer
// So this is way more efficient like this, so instead of having to write the file to the disk and then here read it again, we simply keep the image basically in memory and then here we can read that.
const multerStorage = multer.memoryStorage();

// And in this function, the goal is basically to test if the uploaded file is an image. And if it is so, then we pass true into the callback function, and if it's not we pass false into the callback function, along with an error.
const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images', 400), false);
  }
};

// That is exactly the folder where we want to save all the images that are being uploaded.
// NOT: let's just make really sure that images are not directly uploaded into the database, we just upload them into our file system and then in the database we put a link basically to that image. So each user document we will have to name all of the uploaded file.
// What we need to do now is to use this upload to really create a middleware function that we can put here into the updateMe route.
const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadUserPhoto = upload.single('photo');

// Well we created a new middleware function that is going to be running right after the photo is actually uploaded. And that upload is now actually  happening to a buffer and no longer directly to the file system. And so that's why we use this memory storage, but of course multer filter is still working. And so we can still only upload images. So then here in that middleware we put image's file name on req.file dot file name so that we can then use it in the update me.
exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next();

  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;

  // Calling the sharp function like this here will create an object on which we can chain multiple methods in order to do our image processing.
  await sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat('jpeg')
    .jpeg({ quality: 90 }) // 90%
    .toFile(`public/img/users/${req.file.filename}`);

  next();
});

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

exports.updateMe = catchAsync(async (req, res, next) => {
  // request postman'dan body > form-data > name: Leo J. Gillespie. photo field'ı (userRoute'da belirtmiştik) için ise file seçeneğini seçip photo: leo.jpg olarak girdik.
  // console.log(req.file); // upload middleware function will put the file or at least some information about the file on the request object.
  // {
  //       fieldname: 'photo',
  //       originalname: 'leo.jpg',
  //       encoding: '7bit',
  //       mimetype: 'image/jpeg',
  //       destination: 'public/img/users',
  //       filename: '1f18d8853eeac6fb4cf2ca041684f641', // Eklediğimiz image'ın ismi bu şekilde oldu
  //       path: 'public\\img\\users\\1f18d8853eeac6fb4cf2ca041684f641',
  //       size: 207078
  // }
  // console.log(req.body); // { name: 'Leo J. Gillespie' }. Görüldüğü üzere body-parser dosyayı gösteremedi. Bu yüzden multer paketini kullanıyoruz.

  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates. Please use /updateMyPassword.',
        400
      )
    );
  }

  // 2) Filtered out unwanted fields names that are not allowed to be updated
  const filteredBody = filterObj(req.body, 'name', 'email');
  // Remember, that we only really store the image name to our documents, and not the entire path to the image.
  if (req.file) filteredBody.photo = req.file.filename;

  // 3) Update user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.createUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not defined! Please use /signup instead',
  });
};

exports.getUser = factory.getOne(User);
exports.getAllUsers = factory.getAll(User);
// Do NOT update passwords with this
exports.updateUser = factory.updateOne(User);
exports.deleteUser = factory.deleteOne(User);
