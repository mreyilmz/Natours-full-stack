module.exports = (fn) => (req, res, next) => {
  // fn(req, res, next).catch((err) => next(err)); // Alttaki kod ile bu kod birbirine eşit
  fn(req, res, next).catch(next);
};
