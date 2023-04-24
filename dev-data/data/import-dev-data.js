const mongoose = require('mongoose');
const fs = require('fs');
const dotenv = require('dotenv');
const Tour = require('./../../models/tourModel');
const User = require('./../../models/userModel');
const Review = require('./../../models/reviewModel');

dotenv.config({ path: './config.env' });

const DB = process.env.DATABASE.replace('<PASSWORD>', process.env.PASSWORD);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
  })
  .then(() => {
    console.log('DB connection successful!');
  });

// READ JSON FILE
const tours = JSON.parse(fs.readFileSync(`${__dirname}/tours.json`, 'utf-8'));
const users = JSON.parse(fs.readFileSync(`${__dirname}/users.json`, 'utf-8'));
const reviews = JSON.parse(
  fs.readFileSync(`${__dirname}/reviews.json`, 'utf-8')
);

// IMPORT DATA INTO COLLECTION
const importData = async () => {
  try {
    await Tour.create(tours); // create methodu array of objects de kabul ediyor. Array içindeki herbir object için yeni bir document oluşturacak.
    await User.create(users); // Password
    await Review.create(reviews);
    console.log('Data successfully loaded!');
  } catch (err) {
    console.log(err);
  }
  process.exit(); // node dev-data/data/import-dev-data.js firstArg secondArg ... komutuyla rogram çalışmaya devam ediyor bu yüzden durdurmak için bu kodu kullanıyoruz fakat bu yöntem biraz agresif diyebiliriz. Ama script'imiz ufak çaplı old. için sorun olmadı.
};

// DELETE ALL DATA FROM DB
const deleteData = async () => {
  try {
    await Tour.deleteMany(); // deleteMany methodu birden fazla document silmek için kullanılır. İçine herhangi bir document girilmezse collection içindeki tüm documentları siler.
    await User.deleteMany();
    await Review.deleteMany();

    console.log('Data successfully deleted!');
  } catch (err) {
    console.log(err);
  }
  process.exit();
};

// Konsola node dev-data/data/import-dev-data.js komutunu yazdık.
// console.log(process.argv) kodu konsola aşağıdaki satırları yazdı
/*  
  [
  'C:\\Program Files\\nodejs\\node.exe',
  'C:\\Users\\mreyl\\Desktop\\Node.js Development\\4-Natours\\dev-data\\data\\import-dev-data.js', 
  ] 
*/
// Yukarıdaki array'da iki eleman var. İlki node.js'nin absolute path'i. İkincisi ise .js dosyamızın absolute pathi.
// Fakat node dev-data/data/import-dev-data.js firstArg secondArg ... komutuyla ilk iki elemandan sonra argumentlar verebiliyoruz. Hoca 3. eleman yani ilk argument olarak --import veya --delete verdi ve bu değerlere göre de fonksiyonlar çalıştırdı. Argument olarak istediğimiz şeyi girebiliriz. Baştaki dash'ler şart değil.
// console.log(process.argv);

if (process.argv[2] === '--import') {
  importData();
} else if (process.argv[2] === '--delete') {
  deleteData();
}
