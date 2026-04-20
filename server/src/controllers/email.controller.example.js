// Example: Using Nodemailer in Your Controllers
// This file shows practical examples of how to send emails using the mail.js utility

import jwt from 'jsonwebtoken';
import {
  sendEmail,
  emailVerificationMailgenContent,
  forgotPasswordMailgenContent,
  accountConfirmationMailgenContent,
} from '@/utils/mail.js';

// ════════════════════════════════════════════════════════════════
// Example 1: Send Verification Email on User Registration
// ════════════════════════════════════════════════════════════════

export const registerUserWithEmail = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'Name, email, and password are required',
      });
    }

    // Check if user already exists
    // const existingUser = await User.findOne({ email });
    // if (existingUser) {
    //   return res.status(409).json({ error: 'User already exists' });
    // }

    // Create new user
    // const user = new User({
    //   name,
    //   email,
    //   password: await hashPassword(password), // Hash password before saving
    //   isEmailVerified: false,
    // });
    // await user.save();

    // Generate email verification token (valid for 24 hours)
    const verificationToken = jwt.sign(
      {
        userId: 'user._id', // Replace with actual user._id
        email: email,
        type: 'email_verification',
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Create verification link
    const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;

    // Generate email content
    const mailContent = emailVerificationMailgenContent(name, verificationUrl);

    // Send verification email
    try {
      await sendEmail({
        email: email,
        subject: '📧 Verify Your Email Address - Ridgeway OIP',
        mailgenContent: mailContent,
      });

      console.log(`✅ Verification email sent to ${email}`);

      return res.status(201).json({
        message:
          'User registered successfully. Please check your email to verify your email address.',
        userId: 'user._id', // Replace with actual user._id
        requiresEmailVerification: true,
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError.message);

      // User is created, but email failed
      return res.status(201).json({
        message:
          'User registered successfully, but email could not be sent. Please try resending the verification email.',
        userId: 'user._id',
        emailError: true,
      });
    }
  } catch (error) {
    console.error('Registration error:', error.message);
    return res.status(500).json({
      error: 'Registration failed',
      details: error.message,
    });
  }
};

// ════════════════════════════════════════════════════════════════
// Example 2: Send Password Reset Email
// ════════════════════════════════════════════════════════════════

export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user by email
    // const user = await User.findOne({ email });
    // if (!user) {
    //   // Don't reveal if user exists - for security
    //   return res.status(200).json({
    //     message: 'If an account exists with this email, a reset link has been sent.',
    //   });
    // }

    // Generate password reset token (valid for 1 hour)
    const resetToken = jwt.sign(
      {
        userId: 'user._id', // Replace with actual user._id
        email: email,
        type: 'password_reset',
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create reset URL
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;

    // Generate email content
    const mailContent = forgotPasswordMailgenContent('user.name', resetUrl);

    // Send password reset email
    try {
      await sendEmail({
        email: email,
        subject: '🔒 Reset Your Password - Ridgeway OIP',
        mailgenContent: mailContent,
      });

      console.log(`✅ Password reset email sent to ${email}`);

      return res.status(200).json({
        message:
          'If an account exists with this email, a password reset link has been sent.',
      });
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError.message);

      return res.status(500).json({
        error: 'Failed to send reset email. Please try again later.',
      });
    }
  } catch (error) {
    console.error('Password reset request error:', error.message);
    return res.status(500).json({
      error: 'Password reset request failed',
    });
  }
};

// ════════════════════════════════════════════════════════════════
// Example 3: Send Account Confirmation Email
// ════════════════════════════════════════════════════════════════

export const confirmEmailVerification = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    // Verify and decode token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== 'email_verification') {
      return res.status(400).json({ error: 'Invalid token type' });
    }

    // Find user and update email verified status
    // const user = await User.findByIdAndUpdate(
    //   decoded.userId,
    //   { isEmailVerified: true },
    //   { new: true }
    // );

    // Send confirmation email
    try {
      const mailContent = accountConfirmationMailgenContent('user.name');

      await sendEmail({
        email: decoded.email,
        subject: '✅ Email Verified - Ridgeway OIP',
        mailgenContent: mailContent,
      });

      console.log(`✅ Confirmation email sent to ${decoded.email}`);

      return res.status(200).json({
        message: 'Email verified successfully! You can now log in to your account.',
      });
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError.message);

      // Email verification is successful, confirmation email just failed
      return res.status(200).json({
        message:
          'Email verified successfully! (Confirmation email could not be sent)',
      });
    }
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({
        error: 'Verification token has expired. Please request a new one.',
      });
    }

    console.error('Email verification error:', error.message);
    return res.status(400).json({
      error: 'Email verification failed. Invalid or expired token.',
    });
  }
};

// ════════════════════════════════════════════════════════════════
// Example 4: Send Custom Email with Mailgen
// ════════════════════════════════════════════════════════════════

export const sendCustomNotification = async (req, res) => {
  try {
    const { email, username, title, message, actionUrl, actionText } = req.body;

    // Validate required fields
    if (!email || !username || !title || !message) {
      return res.status(400).json({
        error: 'Email, username, title, and message are required',
      });
    }

    // Build custom email content
    const customContent = {
      body: {
        name: username,
        intro: title,
        action: actionUrl && actionText
          ? {
            instructions: message,
            button: {
              color: '#22BC66',
              text: actionText,
              link: actionUrl,
            },
          }
          : undefined,
        outro: actionUrl && actionText
          ? 'Thank you for using Ridgeway OIP!'
          : message,
      },
    };

    // Remove undefined action if no action URL provided
    if (!actionUrl || !actionText) {
      delete customContent.body.action;
    }

    // Send email
    await sendEmail({
      email: email,
      subject: title,
      mailgenContent: customContent,
    });

    console.log(`✅ Custom notification sent to ${email}`);

    return res.status(200).json({
      message: 'Email sent successfully',
    });
  } catch (error) {
    console.error('Failed to send custom email:', error.message);
    return res.status(500).json({
      error: 'Failed to send email',
      details: error.message,
    });
  }
};

// ════════════════════════════════════════════════════════════════
// Example 5: Resend Verification Email
// ════════════════════════════════════════════════════════════════

export const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user
    // const user = await User.findOne({ email });
    // if (!user) {
    //   return res.status(404).json({ error: 'User not found' });
    // }

    // if (user.isEmailVerified) {
    //   return res.status(400).json({ error: 'Email is already verified' });
    // }

    // Generate new verification token
    const verificationToken = jwt.sign(
      {
        userId: 'user._id', // Replace with actual user._id
        email: email,
        type: 'email_verification',
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;

    // Send verification email
    await sendEmail({
      email: email,
      subject: '📧 Verify Your Email Address - Ridgeway OIP',
      mailgenContent: emailVerificationMailgenContent('user.name', verificationUrl),
    });

    console.log(`✅ Verification email resent to ${email}`);

    return res.status(200).json({
      message: 'Verification email has been resent. Please check your inbox.',
    });
  } catch (error) {
    console.error('Failed to resend verification email:', error.message);
    return res.status(500).json({
      error: 'Failed to resend verification email',
      details: error.message,
    });
  }
};

// ════════════════════════════════════════════════════════════════
// Example 6: Bulk Email Sending
// ════════════════════════════════════════════════════════════════

export const sendBulkNotification = async (req, res) => {
  try {
    const { emails, subject, message } = req.body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'Valid email array is required' });
    }

    if (!subject || !message) {
      return res.status(400).json({
        error: 'Subject and message are required',
      });
    }

    const results = {
      success: [],
      failed: [],
    };

    // Send email to each recipient
    for (const email of emails) {
      try {
        const customContent = {
          body: {
            intro: subject,
            outro: message,
          },
        };

        await sendEmail({
          email: email,
          subject: subject,
          mailgenContent: customContent,
        });

        results.success.push(email);
      } catch (error) {
        console.error(`Failed to send email to ${email}:`, error.message);
        results.failed.push({
          email: email,
          error: error.message,
        });
      }
    }

    console.log(`📊 Bulk email results - Success: ${results.success.length}, Failed: ${results.failed.length}`);

    return res.status(200).json({
      message: 'Bulk email sending completed',
      results: results,
    });
  } catch (error) {
    console.error('Bulk email sending error:', error.message);
    return res.status(500).json({
      error: 'Bulk email sending failed',
      details: error.message,
    });
  }
};

export default {
  registerUserWithEmail,
  requestPasswordReset,
  confirmEmailVerification,
  sendCustomNotification,
  resendVerificationEmail,
  sendBulkNotification,
};
