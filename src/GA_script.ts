
//The GA4 Property Id. https://support.google.com/analytics/answer/10089681?hl=en&ref_topic=9143232
const gaId: string = "G-Z469MW8V6G";
export const gaComment = '<!-- Global site tag (gtag.js) - Google Analytics -->';
export const gtagUrl = `<script async src='https://www.googletagmanager.com/gtag/js?id=${gaId}'></script>`;
export const gaScript = `<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', '${gaId}');
</script>`;