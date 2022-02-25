//Create a simple license report html page
var checker = require("license-checker");
var fs = require("fs");

var template = fs.readFileSync("license-report-template.html").toString();

checker.init(
  {
    start: ".",
  },
  function (err, packages) {
    if (err) {
      console.log(err);
    } else {
      var report = "";
      for (package in packages) {
        let package_info = packages[package];
        let licenseText = fs.readFileSync(package_info.licenseFile);
        let entry =
          `<h2><a href="${package_info.repository}">${package}</a></h2>` +
          (package_info.publisher
            ? `<p>Publisher: ${package_info.publisher}</p>`
            : "") +
          `<p>License: ${package_info.licenses}</p>` +
          `<h3>License Text</h3>` +
          `<p><pre>${licenseText.toString()}</pre></p>`;
        report += entry;
      }
      let output = template.replace("{{content}}", report);
      console.log(output);
    }
  }
);
