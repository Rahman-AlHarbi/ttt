/* cert.js – Canvas-based Certificate Generator */
import * as storage from './storage.js';
import { generateVerificationId } from './engine.js';
import { getGrade, formatDate } from './ui.js';

export function generateCertificate(config) {
  const profile = storage.getProfile();
  const progress = storage.getProgress();
  const avgPercent = progress.totalAnswered > 0 ? Math.round((progress.totalCorrect / progress.totalAnswered) * 100) : 0;
  const grade = getGrade(avgPercent);
  const vid = generateVerificationId();
  const date = new Date().toISOString();

  const certData = {
    name: profile.name,
    className: profile.className,
    date, avgPercent, grade,
    verificationId: vid,
    xp: progress.xp,
    textsCompleted: progress.textsCompleted
  };

  storage.setCertData(certData);
  return certData;
}

/* Draw certificate on Canvas */
export function drawCertificateCanvas(certData, config) {
  return new Promise((resolve) => {
    const W = 1200, H = 850;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    // Border
    const borderGrad = ctx.createLinearGradient(0, 0, W, H);
    borderGrad.addColorStop(0, '#0D6EFD');
    borderGrad.addColorStop(1, '#0A1E3D');
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 12;
    ctx.strokeRect(20, 20, W - 40, H - 40);

    // Inner border
    ctx.strokeStyle = '#FFB930';
    ctx.lineWidth = 3;
    ctx.strokeRect(35, 35, W - 70, H - 70);

    // Decorative corner elements
    const cornerSize = 40;
    ctx.fillStyle = '#FFB930';
    [[50, 50], [W - 50 - cornerSize, 50], [50, H - 50 - cornerSize], [W - 50 - cornerSize, H - 50 - cornerSize]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x + cornerSize / 2, y + cornerSize / 2, 8, 0, Math.PI * 2);
      ctx.fill();
    });

    // Title area gradient
    const titleGrad = ctx.createLinearGradient(0, 60, 0, 160);
    titleGrad.addColorStop(0, 'rgba(13,110,253,0.05)');
    titleGrad.addColorStop(1, 'rgba(13,110,253,0)');
    ctx.fillStyle = titleGrad;
    ctx.fillRect(60, 60, W - 120, 100);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title
    ctx.fillStyle = '#0A1E3D';
    ctx.font = 'bold 48px Tajawal, sans-serif';
    ctx.fillText(config.certificate?.title || 'شهادة إنجاز', W / 2, 120);

    // Slogan
    ctx.fillStyle = '#0D6EFD';
    ctx.font = '24px Tajawal, sans-serif';
    ctx.fillText(config.slogans?.primary || 'أبطال القراءة', W / 2, 175);

    // Star decoration
    ctx.fillStyle = '#FFB930';
    ctx.font = '36px sans-serif';
    ctx.fillText('⭐', W / 2, 220);

    // Body text
    ctx.fillStyle = '#333';
    ctx.font = '22px Tajawal, sans-serif';
    ctx.fillText('يُشهد بأن الطالب/ة', W / 2, 280);

    // Student name
    ctx.fillStyle = '#0A1E3D';
    ctx.font = 'bold 40px Tajawal, sans-serif';
    ctx.fillText(certData.name, W / 2, 330);

    // Underline
    ctx.strokeStyle = '#FFB930';
    ctx.lineWidth = 2;
    const nameWidth = ctx.measureText(certData.name).width;
    ctx.beginPath();
    ctx.moveTo(W / 2 - nameWidth / 2 - 20, 355);
    ctx.lineTo(W / 2 + nameWidth / 2 + 20, 355);
    ctx.stroke();

    // Class
    ctx.fillStyle = '#555';
    ctx.font = '22px Tajawal, sans-serif';
    ctx.fillText('من الصف: ' + certData.className, W / 2, 390);

    // Achievement text
    ctx.fillStyle = '#333';
    ctx.font = '22px Tajawal, sans-serif';
    ctx.fillText('قد أتمّ بنجاح تحدي أبطال القراءة', W / 2, 435);

    // Grade & Average
    ctx.fillStyle = '#0D6EFD';
    ctx.font = 'bold 32px Tajawal, sans-serif';
    ctx.fillText('بتقدير: ' + certData.grade + ' — بمعدل: ' + certData.avgPercent + '%', W / 2, 490);

    // Stats row
    ctx.fillStyle = '#666';
    ctx.font = '20px Tajawal, sans-serif';
    ctx.fillText(
      'النصوص المكتملة: ' + certData.textsCompleted + '  |  النقاط: ' + certData.xp + ' XP',
      W / 2, 540
    );

    // Date
    ctx.fillStyle = '#888';
    ctx.font = '18px Tajawal, sans-serif';
    ctx.fillText('التاريخ: ' + formatDate(certData.date), W / 2, 590);

    // School & Teacher
    if (config.school_name) {
      ctx.fillStyle = '#0A1E3D';
      ctx.font = 'bold 20px Tajawal, sans-serif';
      ctx.fillText(config.school_name, W / 2, 640);
    }
    if (config.teacher_name) {
      ctx.fillStyle = '#555';
      ctx.font = '18px Tajawal, sans-serif';
      ctx.fillText(config.teacher_name, W / 2, 670);
    }

    // Divider
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(200, 710);
    ctx.lineTo(W - 200, 710);
    ctx.stroke();

    // Verification ID
    ctx.fillStyle = '#999';
    ctx.font = '16px monospace';
    ctx.fillText('رقم التحقق: ' + certData.verificationId, W / 2, 740);

    // Bottom branding
    ctx.fillStyle = '#B0B0B0';
    ctx.font = '14px Tajawal, sans-serif';
    ctx.fillText(config.rights_text || 'جميع الحقوق محفوظة © 2026 - أبطال القراءة', W / 2, 780);

    // Try to load school logo
    const schoolImg = new Image();
    schoolImg.crossOrigin = 'anonymous';
    schoolImg.onload = () => {
      ctx.drawImage(schoolImg, W / 2 - 30, 55, 60, 60);
      resolve(canvas);
    };
    schoolImg.onerror = () => resolve(canvas);
    schoolImg.src = config.logos?.school || 'assets/logo-school.png';

    // Timeout fallback
    setTimeout(() => resolve(canvas), 2000);
  });
}

export async function downloadCertAsPNG(certData, config) {
  const canvas = await drawCertificateCanvas(certData, config);
  const link = document.createElement('a');
  link.download = 'شهادة_أبطال_القراءة_' + certData.name + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}
