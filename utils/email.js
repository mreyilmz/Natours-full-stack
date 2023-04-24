const nodemailer = require('nodemailer');
const pug = require('pug');
const { htmlToText } = require('html-to-text');

// We created a new email class from which we can create email objects that we can then use to send actual emails.

// And to create a new email object, we will paste in the user and also a URL that we want to be in that email.
module.exports = class Email {
  constructor(user, url) {
    // So then here we assign all that stuff to the current object, and also some other settings that we want to have available, such as the first name and the sender email.
    // So basically to abstract this information away from the send function, and to have it all in one central place.
    this.to = user.email;
    this.firstName = user.name.split(' ')[0];
    this.url = url;
    this.from = `Emre Yılmaz <${process.env.EMAIL_FROM}>`;
  }

  // Then we have here a new transport function which makes it really easy to create different transports for different environments.
  // So when we're in production, we actually want to send real emails, and we will do that using SendGrid, but if we are not in production then we still want to use our Mailtrap application. So instead of the email going to a real email address, it will get caught into our Mailtrap inbox so that we can actually take a look at it in our development process.
  newTransport() {
    if (process.env.NODE_ENV === 'production') {
      // Sendgrid
      return nodemailer.createTransport({
        service: 'SendGrid',
        auth: {
          user: process.env.SENDGRID_USERNAME,
          pass: process.env.SENDGRID_PASSWORD,
        },
      });
    }

    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  // Send the actual email
  // So then here is that send function which takes in a template and a subject, and based on that it creates the HTML from a pug template which will then be set into the email options, which will, at the end of the function,
  async send(template, subject) {
    // 1) Render HTML based on a pug template
    // This will take in the file and then render the pug code into real HTML.
    const html = pug.renderFile(`${__dirname}/../views/email/${template}.pug`, {
      firstName: this.firstName,
      url: this.url,
      subject,
    });

    // 2) Define email options
    // In this case we do not really want to render, all we want to do is to basically create the HTML out of the template so that we can then send that HTML as the email.
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html,
      text: htmlToText(html),
    };

    // 3) Create a transport and send email
    // then finally be sent in this line of code.
    await this.newTransport().sendMail(mailOptions);
  }

  async sendWelcome() {
    await this.send('welcome', 'Welcome to the Natours Family');
  }

  async sendPasswordReset() {
    await this.send(
      'passwordReset',
      'Your password reset token (valid for only 10 minutes)'
    );
  }
};

// const sendEmail = async (options) => {
//   const transporter = nodemailer.createTransport({
//     host: process.env.EMAIL_HOST,
//     port: process.env.EMAIL_PORT,
//     auth: {
//       user: process.env.EMAIL_USERNAME,
//       pass: process.env.EMAIL_PASSWORD,
//     },
//   });

//   const mailOptions = {
//     from: 'mre.ylmaz@gmail.com',
//     to: options.email,
//     subject: options.subject,
//     text: options.message,
//   };
//   await transporter.sendMail(mailOptions);
// };

// module.exports = sendEmail;
