// lib/email/resend.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(email: string, code: string, nama: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'Smartify <noreply@smartify.com>',
      to: email,
      subject: 'Verifikasi Email Smartify - Kode OTP Anda',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Poppins', Arial, sans-serif; background-color: #f5f7fa; margin: 0; padding: 0;">
          <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <!-- Header with Logo -->
            <div style="background: linear-gradient(135deg, #4ac9ff 0%, #2d9cdb 100%); padding: 30px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Smartify</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0;">Platform Generate Quiz Digital</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 30px 25px;">
              <h2 style="color: #1a1a1a; margin-top: 0;">Halo, ${nama}! 👋</h2>
              <p style="color: #4a5568; line-height: 1.6;">Terima kasih telah mendaftar di <strong>Smartify</strong>. Gunakan kode verifikasi di bawah ini untuk mengaktifkan akun Anda:</p>
              
              <!-- Verification Code Box -->
              <div style="background-color: #f0f9ff; border: 2px dashed #4ac9ff; border-radius: 16px; padding: 20px; text-align: center; margin: 25px 0;">
                <div style="font-size: 42px; letter-spacing: 12px; font-weight: bold; color: #2d9cdb; font-family: monospace;">
                  ${code}
                </div>
                <p style="color: #718096; margin: 12px 0 0; font-size: 12px;">Kode ini bersifat rahasia, jangan bagikan ke siapa pun</p>
              </div>
              
              <div style="background-color: #fff3e0; border-radius: 12px; padding: 15px; margin: 20px 0;">
                <p style="color: #e67e22; margin: 0; font-size: 14px;">
                  ⏰ Kode ini akan kadaluarsa dalam <strong>15 menit</strong>
                </p>
              </div>
              
              <p style="color: #4a5568; line-height: 1.6;">
                Jika Anda tidak merasa mendaftar di Smartify, abaikan email ini. Tidak perlu melakukan tindakan apapun.
              </p>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f5f7fa; padding: 20px 25px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #a0aec0; margin: 0; font-size: 12px;">
                &copy; 2024 Smartify - Platform Generate Quiz Digital<br>
                Membantu Guru Membuat Soal dengan Mudah
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Email sending failed:', error);
    throw new Error('Gagal mengirim email verifikasi');
  }
}