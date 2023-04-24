const mongoose = require('mongoose');
const slugify = require('slugify');
const validator = require('validator');
// const User = require('./userModel');

const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tour must have name'],
      unique: true,
      trim: true,
      maxlength: [40, 'A tour name must have less or equal then 40 characters'],
      minlength: [10, 'A tour name must have more or equal then 10 characters'],
      validate: {
        validator: function (val) {
          const value = val.split(' ').join('');
          return validator.isAlpha(value);
        },
        message: 'Tour name must only contain letters',
      },
    },
    slug: String,
    duration: {
      type: Number,
      required: [true, 'A tour must have duration'],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have group size'],
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty'],
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty is either: easy, medium, difiicult',
      },
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating must be below 5.0'],
      // A setter function here which is going to be run each time that there is a new value for the ratings average field. And so here, we usually specify a callback function, which receives the current value. And in this case, it returns basically this value, but rounded.
      set: (val) => Math.round(val * 10) / 10, // val 4.666 ise 5'e yuvarlar fakat 10 ile çarpıp bölersek 46.666 > 47 ve 4.7 elde etmiş oluruz.
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'A tour must have price'],
    },
    /////////////// Custom Validation
    priceDiscount: {
      type: Number,
      validate: {
        validator: function (val) {
          return val < this.price;
        },

        message: 'Discount price ({VALUE}) should be below regular price',
      },
    },
    summary: {
      type: String,
      trim: true,
      required: [true, 'A tour must have a summary'],
    },
    description: {
      type: String,
    },
    imageCover: {
      type: String,
      required: [true, 'A tour must have a cover image'],
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false,
    },
    startDates: [Date],
    secretTour: {
      type: Boolean,
      default: false,
    },
    // MongoDB supports geospatial data out of the box. Geospatial data is basically data that describes places on earth using longitude and latitude coordinates. MongoDB uses a special data format called GeoJSON.
    // In order to specify geospatial data with MongoDB, we need to create a new object. And that object then needs to have at least two field names. So COORDINATES has this array of numbers and then the TYPE, which should be of type string and should be either point or some other of these other geometries.
    startLocation: {
      type: {
        type: String,
        default: 'Point',
        // Let's make that the only possible option by specifying the enum. We can specify an array of all the possible options that this field can take and so in this case, we only want it to be point.
        enum: ['Point'],
      },
      // We expect an array of numbers and this array, as the name says, is the coordinates.
      coordinates: [Number],
      address: String,
      description: String,
    },
    // In order to really create new documents and then embed them into another document, we actually need to create an array. So it's actually very similar to what we already did above, but it needs to be an array.
    // Köşeli parantez içine aldığımız için MongoDB tüm locations elemanlarını birer embedded document olarak kabul edecek ve hepsine birer id verecek.
    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point'],
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number,
      },
    ],
    // guides: Array,
    // The idea is that tours and users will always remain completely separate entities in our database. So all we save on a certain tour document is the IDs of the users that are the tour guides for that specific tour. Then when we query the tour, we want to automatically get access to the tour guides. But, without them being actually saved on the tour document itself. This exactly is referencing.
    guides: [
      {
        type: mongoose.Schema.ObjectId, // What we expect is that type of each of the elements in the guides array to be a MongoDB ID.
        ref: 'User', // This is where the magic happens behind the scenes, because here, we say that the reference should be user. And so this really is how we establish references between different data sets in Mongoose.
      },
    ],
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    id: false,
  }
);

// Whenever documents are queried by the ID MongoDB will search that ordered index instead of searching through the whole collection and look at all the documents one by one, which is of course much slower. So again without an index Mongo has to look at each document one by one. But with an index on the field that we are querying for, this process becomes much more efficient.
// How do we decide which field we actually need to index? And why don't we set indexes on all the fields?
// Because we really do not want to overdo it with indexes. So we don't want to blindly set indexes on all the fields and then hope for the best basically. And the reason for that is that each index actually uses resources.
// So basically we need to carefully study the access patterns of our application in order to figure out which fields are queried the most and then set the indexes for these fields.
// For example, I'm not setting an index here on the group size because many people will not query for that parameter, and so no need to create an index there.

// index ile birlikte, price'a göre arama yaptığımızda sadece kritere uyanları bulacak ve performanstan ve zamandan kazanç sağlayacağız.
tourSchema.index({ price: 1, ratingsAverage: -1 }); // One means that we're sorting the price index in an ascending order, while the minus one stands for descending order.
tourSchema.index({ slug: 1 });
// If you have a "test tour" somewhere, chances are you didn't put anything in the "coordinates" field of the "startLocation" field. If any document of your collection is missing proper format for indexing, the index won't be created.
tourSchema.index({ startLocation: '2dsphere' }); // We are talking about real points on the Earth's surface, so we're going to use a 2D sphere index here. So a 2D sphere like this. So we're basically telling that this start location here should be indexed to a 2D sphere. So an Earthlike sphere where all our data are located.

tourSchema.virtual('durationWeeks').get(function () {
  if (this.duration) return this.duration / 7;
});

// Virtual populate
// With 'Virtual Populate,' we can actually populate the tour with reviews. So, in other words, we can get access to all the reviews for a certain tour, but without keeping this array of ID's on the tour. So, think of 'Virtual Populate' like a way of keeping that array of review ID's on a tour, but without actually persisting it to the database.
tourSchema.virtual('reviews', {
  ref: 'Review', // The name of the model that we want to reference.
  foreignField: 'tour', // This is the name of the field in other model
  localField: '_id', // ID is actually stored here in this current Tour model. this _ID, which is how it's called in the local model, is called 'tour' in the foreign model. So, in the Review model.
});

tourSchema.pre('save', function (next) {
  // console.log(this); // in a save middleware, the this keyword is gonna point to the currently processed document
  this.slug = slugify(this.name, { lower: true });
  next();
});

tourSchema.pre(/^find/, function (next) {
  this.find({ secretTour: { $ne: true } });
  this.start = Date.now();
  next();
});

// find ile başlayan tüm query'lerde, guides field'ı varsa path ile doldurduk ve select ile (başlarına "-" koyarak) görünmesini istemediğimiz field'ları kaldırdık.
// Behind the scenes, using populate will still actually create a new query, and so this might affect your performance. Of course if you only do it once or twice and in a kind of small application, then that small hit on performance is no big deal at all.
// Çok YARARLI method.
tourSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt',
  });
  next();
});

// tourSchema.post(/^find/, function (docs, next) {
//   console.log(`Query took ${Date.now() - this.start} milliseconds!`);
//   next();
// });

const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
