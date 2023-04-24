const mongoose = require('mongoose');
const Tour = require('./tourModel');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'Review can not be empty!'],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'Review must belong to a tour.'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user'],
    },
  },
  {
    // All this does is to really make sure that when we have a virtual property, basically a field that is not stored in the database but calculated using some other value. So we want this to also show up whenever there is an output.
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    id: false,
  }
);

// İkinci object aslında bir options
// So now each combination of tour and user has always to be unique.
// Bu kod ile kullanıcı aynı tour için 1'den fazla review yapamayacak
reviewSchema.index({ tour: 1, user: 1 }, { unique: true });

reviewSchema.pre(/^find/, function (next) {
  // this.populate({
  //   // tour field'ını işaret ettik
  //   path: 'tour',
  //   select: '-guides name',
  //   // user field'ını işaret ettik
  // }).populate({
  //   path: 'user',
  //   select: 'name photo',
  // });
  this.populate({
    path: 'user',
    select: 'name photo',
  });
  next();
});

// In a static method THIS keyword actually points to the current model
reviewSchema.statics.calcAverageRatings = async function (tourId) {
  const stats = await this.aggregate([
    {
      $match: { tour: tourId },
    },
    {
      $group: {
        _id: 'null',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);

  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating,
    });
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5,
    });
  }
};

// We are actually performing an asynchronous operation inside our post save hook, but we only have a single post save hook in our model, which means we don't have to wait for it to finish or execute multiple post save hooks in specific order.
reviewSchema.post('save', function () {
  // THIS points to current review
  this.constructor.calcAverageRatings(this.tour); // this.constructor points to the model. constructor current document'ı yaratan model'a eşittir.
});

reviewSchema.post(/^findOneAnd/, async (doc) => {
  if (doc) {
    await doc.constructor.calcAverageRatings(doc.tour);
  }
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
