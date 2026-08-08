import { escapeHtml } from '@finance-crm/common';

/**
 * Ported verbatim (markup unchanged) from `common_lead_thank_you_email()`
 * in `components/includes/functions.inc.php` — the real lead-application-
 * received confirmation email. `escapeHtml` added around the two
 * interpolated values (legacy concatenates `$name`/`$reference_no`
 * directly into the HTML string with no escaping at all — a latent
 * stored-XSS-in-email risk if either ever contains HTML; not reproduced).
 */
export function renderThankYouEmailHtml(
  name: string,
  referenceNo: string,
): string {
  const safeName = escapeHtml(name);
  const safeReferenceNo = escapeHtml(referenceNo);

  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <title>Thank You | Salary On Time</title>
</head>
<body>
    <table width="400" border="0" align="center"
        style="font-family:Arial, Helvetica, sans-serif; border:solid 1px #ddd; padding:10px; background:#f9f9f9;">
        <tr>
            <td width="775" align="center" style="background: #225395;"><img
                    src="https://salaryontime.com/static/media/logo.64e094820f6a4233a384.png" width="40%"></td>
        </tr>
        <tr>
            <td style="text-align:center;">
                <table width="418" border="0" style="text-align:center; padding:20px; background:#fff;">
                    <tr>
                        <td style="font-size:16px;"><img src="https://salaryontime.in/public/emailimages/thank-you.gif"
                                width="auto" height="250" alt="thank-you"></td>
                    </tr>
                    <tr>
                        <td style="font-size:16px;">&nbsp;</td>
                    </tr>
                    <tr>
                        <td width="412" style="font-size:16px;">
                            <h2 style="margin:0px; color:#116a97;">Thank You</h2>
                        </td>
                    </tr>
                    <tr>
                        <td width="412" style="font-size:16px;">
                            <h2 style="margin:0px; color:#116a97;">Dear ${safeName}</h2>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <p style="line-height:25px; margin:0px;">Thank you for showing interest in Salaryontime.</p>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <p style="line-height:25px; margin:0px;">We have received your loan application <strong
                                    style="color:#116a97;">${safeReferenceNo}</strong> successfully. Please note the
                                same for future communication.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        <tr>
            <td align="center">&nbsp;</td>
        </tr>
        <tr>
            <td align="center">Follow Us On</td>
        </tr>
        <td align="center">
            <a href="https://www.facebook.com/salaryontime" target="_blank"
                style="margin: 0 10px; text-decoration: none;">
                <img src="https://salaryontime.in/public/emailimages/salaryontime-facebook.png" class="socil-t"
                    alt="salaryontime-instagram" style="width:30px;">
            </a>
            <a href="https://www.linkedin.com/company/103731294/admin/" target="_blank"
                style="margin: 0 10px; text-decoration: none;">
                <img src="https://salaryontime.in/public/emailimages/salaryontime-linkedin.png" class="socil-t"
                    alt="salaryontime-instagram" style="width:30px;">
            </a>
            <a href="https://www.instagram.com/salaryontime/" target="_blank"
                style="margin: 0 10px; text-decoration: none;">
                <img src="https://salaryontime.in/public/emailimages/salaryontime-instagram.png" class="socil-t"
                    alt="salaryontime-instagram" style="width:30px;">
            </a>
            <a href="https://www.youtube.com/@salaryontime" target="_blank"
                style="margin: 0 10px; text-decoration: none;">
                <img src="https://salaryontime.in/public/emailimages/salaryontime-youtube.png" class="socil-t"
                    alt="salaryontime-instagram" style="width:30px;">
            </a>
        </td>
        <tr>
            <td align="center">For Latest Updates &amp; Offers</td>
        </tr>
    </table>
</body>
</html>`;
}
