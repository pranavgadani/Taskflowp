require("dotenv").config();
const nodemailer = require("nodemailer");

// 🔐 Strong 8 character password generator
const generatePassword = () => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$!%*?&";
  let password = "";
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// 📩 Create Transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // Gmail App Password
    },
  });
};

// 🎨 Common Email Wrapper
const getEmailLayout = (content, title = "Task Manager") => `
  <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; background-color: #f8fafc; padding: 40px 20px;">
    <div style="background-color: #ffffff; border-radius: 16px; overflow: hidden; boxShadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 32px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">${title}</h1>
      </div>
      
      <!-- Body -->
      <div style="padding: 40px; color: #1e293b; line-height: 1.6;">
        ${content}
      </div>
      
      <!-- Footer -->
      <div style="background-color: #f1f5f9; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; color: #64748b; font-size: 13px; font-weight: 500;">
          © 2025 Task Manager Inc. All rights reserved.
        </p>
        <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">
          This is an automated system notification
        </p>
      </div>
    </div>
  </div>
`;

// 📩 Send Staff Login Email
const sendMail = async (to, name, position, password) => {
  try {
    const transporter = createTransporter();
    const content = `
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Welcome to the Team!</h2>
      <p style="font-size: 16px;">Hello <strong>${name}</strong>,</p>
      <p>Your account has been successfully created. You can now login using the credentials below:</p>
      
      <div style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #e2e8f0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 100px;">Position</td>
            <td style="padding: 8px 0; color: #1e293b; font-weight: 700;">${position}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Email</td>
            <td style="padding: 8px 0; color: #1e293b; font-weight: 700;">${to}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Password</td>
            <td style="padding: 8px 0; color: #2563eb; font-weight: 800; font-family: monospace; font-size: 18px;">${password}</td>
          </tr>
        </table>
      </div>
      
      <p style="color: #ef4444; font-size: 14px; font-weight: 600; background: #fee2e2; padding: 12px; border-radius: 8px; text-align: center;">
        ⚠️ For security, please change your password immediately after your first login.
      </p>
    `;

    await transporter.sendMail({
      from: `"Task Manager Support" <${process.env.EMAIL_USER}>`,
      to,
      subject: "Task Manager | Your Account Credentials",
      html: getEmailLayout(content, "Staff Portal"),
    });

    console.log("✅ Staff email sent to:", to);
  } catch (error) {
    console.error("❌ Staff email failed:", error.message);
  }
};

// 📩 Send Task/Issue Assigned Email
const sendTaskOrIssueMail = async (to, title, description, username, status = null, type = "task") => {
  try {
    const transporter = createTransporter();
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
    
    const content = `
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">📋 New ${typeLabel} Assigned</h2>
      <p style="font-size: 16px;">Hello <strong>${username}</strong>,</p>
      <p>A new <strong>${type}</strong> has been assigned to you. Here are the details:</p>
      
      <div style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #e2e8f0;">
        <p style="margin: 0 0 12px 0;"><strong>Title:</strong> ${title}</p>
        ${description ? `<p style="margin: 0 0 12px 0; color: #475569;"><strong>Description:</strong> ${description}</p>` : ""}
        ${status ? `<p style="margin: 0;"><strong>Initial Status:</strong> <span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${status}</span></p>` : ""}
      </div>
      
      <p>Please log in to your dashboard to begin working on this item.</p>
    `;

    await transporter.sendMail({
      from: `"Task Manager Notifications" <${process.env.EMAIL_USER}>`,
      to,
      subject: `Task Manager | New ${typeLabel}: ${title}`,
      html: getEmailLayout(content, typeLabel + " Notification"),
    });

    console.log(`✅ ${typeLabel} email sent to:`, to);
  } catch (error) {
    console.error(`❌ ${typeLabel} email failed:`, error.message);
  }
};

// 📩 Send Project Assigned Email
const sendProjectMail = async (to, username, projectName, projectDescription, mode = "assigned") => {
  try {
    const transporter = createTransporter();
    const actionLabel = mode === "assigned" ? "Assigned" : "Updated";

    const content = `
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">📁 Project ${actionLabel}</h2>
      <p style="font-size: 16px;">Hello <strong>${username}</strong>,</p>
      <p>You have been ${mode} to the project: <strong>${projectName}</strong>.</p>
      
      <div style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #e2e8f0;">
        <p style="margin: 0 0 12px 0;"><strong>Project:</strong> ${projectName}</p>
        ${projectDescription ? `<p style="margin: 0; color: #475569;"><strong>Description:</strong> ${projectDescription}</p>` : ""}
      </div>
      
      <p>You can now manage tasks and view team members for this project in your dashboard.</p>
    `;

    await transporter.sendMail({
      from: `"Task Manager Projects" <${process.env.EMAIL_USER}>`,
      to,
      subject: `Task Manager | Project ${actionLabel}: ${projectName}`,
      html: getEmailLayout(content, "Project Update"),
    });

    console.log("✅ Project email sent to:", to);
  } catch (error) {
    console.error("❌ Project email failed:", error.message);
  }
};

// 📁 Document Assignment Email
const sendDocumentMail = async (to, memberName, description, appLink) => {
  try {
    const transporter = createTransporter();
    
    const content = `
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">📄 Document Shared</h2>
      <p style="font-size: 16px;">Hi <strong>${memberName}</strong>,</p>
      <p>A document has been shared with you on Task Manager.</p>
      
      ${description ? `
      <div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 16px; border-radius: 4px; margin: 24px 0;">
        <p style="margin: 0; color: #0369a1; font-weight: 500;">Description:</p>
        <p style="margin: 4px 0 0 0; color: #0c4a6e;">${description}</p>
      </div>` : ""}
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${appLink}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">View Document</a>
      </div>
    `;

    await transporter.sendMail({
      from: `"Task Manager Docs" <${process.env.EMAIL_USER}>`,
      to,
      subject: "Task Manager | 📁 Document Shared With You",
      html: getEmailLayout(content, "Document Portal"),
    });
    console.log("✅ Document email sent to:", to);
  } catch (error) {
    console.error("❌ Document email failed:", error.message);
  }
};

// 📩 Access Request Email (to Superadmin)
const sendAccessRequestMail = async (toAdmin, memberName, memberEmail, docDescription, acceptLink) => {
  try {
    const transporter = createTransporter();
    
    const content = `
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">🔐 Access Request</h2>
      <p><strong>${memberName}</strong> (${memberEmail}) has requested access to the following document:</p>
      
      <div style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #e2e8f0;">
        <p style="margin: 0;"><strong>Document:</strong> ${docDescription}</p>
      </div>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${acceptLink}" style="background-color: #16a34a; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">Approve Request</a>
      </div>
    `;

    await transporter.sendMail({
      from: `"Task Manager Security" <${process.env.EMAIL_USER}>`,
      to: toAdmin,
      subject: `Task Manager | Access Request from ${memberName}`,
      html: getEmailLayout(content, "Security Alert"),
    });
    console.log("✅ Access request email sent to superadmin:", toAdmin);
  } catch (error) {
    console.error("❌ Access request email failed:", error.message);
  }
};

// 📩 Reset Password Email
const sendResetPasswordMail = async (to, username, resetLink) => {
  try {
    const transporter = createTransporter();
    
    const content = `
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">🔑 Password Reset</h2>
      <p style="font-size: 16px;">Hi <strong>${username}</strong>,</p>
      <p>We received a request to reset your password. Click the button below to proceed:</p>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetLink}" style="background-color: #1e293b; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">Reset Password</a>
      </div>
      
      <p style="font-size: 13px; color: #64748b; text-align: center;">This link will expire in 1 hour. If you did not request this, please ignore this email.</p>
    `;

    await transporter.sendMail({
      from: `"Task Manager Security" <${process.env.EMAIL_USER}>`,
      to,
      subject: "Task Manager | 🔑 Password Reset Request",
      html: getEmailLayout(content, "Account Recovery"),
    });
    console.log("✅ Reset password email sent to:", to);
  } catch (error) {
    console.error("❌ Reset password email failed:", error.message);
  }
};

module.exports = { generatePassword, sendMail, sendTaskOrIssueMail, sendProjectMail, sendDocumentMail, sendAccessRequestMail, sendResetPasswordMail };

