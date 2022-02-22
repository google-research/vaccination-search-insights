//Create a simple license report html page
var checker = require("license-checker");
var fs = require("fs");
var marked = require("marked");

checker.init(
  {
    start: ".",
  },
  function (err, packages) {
    if (err) {
      console.log(err);
    } else {
      var report = "";
      //Use simple markdown to create each entry
      for (package in packages) {
        let package_info = packages[package];
        let licenseText = fs.readFileSync(package_info.licenseFile);
        let entry =
          `# [${package}](package_info.repository)\n` +
          `Publisher: ${package_info.publisher}\n` +
          `License:${package_info.licenses}\n` +
          `## License Text\n` +
          licenseText.toString() +
          "\n";
        report += entry;
      }
      //then render the markdown to html
      let html_report = marked.parse(report);
      console.log(html_report);
    }
  }
);
