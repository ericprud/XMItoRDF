function main() {

  const TOGGLE_TIME = 50; // time in μsec to toggle collapsed lists.

  const xml2js = require("xml2js");
  // var rs = Ecore.ResourceSet.create();

  $("#myfile").on("change", function (changeEvent) {
    if (!window.FileReader) return; // not supported
    for (var i = 0; i < changeEvent.target.files.length; ++i) {
      (function (file) {
        // Give user some interface feedback before reading.
        var div = $("<div/>", {"id": file.name}).appendTo("#loaded");
        $("<li/>").append($("<a/>", {href: "#"+file.name}).text(file.name)).appendTo("#toc");
        $("<h2/>").text(file.name).appendTo(div);
        var loader = new FileReader();
        loader.onload = function (loadEvent) {
          if (loadEvent.target.readyState != 2)
            return;
          if (loadEvent.target.error) {
            alert("Error while reading file " + file.name + ": " + loadEvent.target.error);
            return;
          }
          // This may take a long time to render.
          $("<textarea/>", {cols:60, rows:10}).val(loadEvent.target.result).appendTo(div);
          render(loadEvent.target.result, file.name);
        };
        loader.readAsText(file);
      })(changeEvent.target.files[i]);
    }
  });

  function render (xmiText, title) {
    var div = $("<div/>", {"id": title, "class": "result"}).appendTo("#render");
    var reparse = $("<button/>").text("reparse").on("click", parse);
    $("<h2/>").text(title).append(reparse).appendTo(div);

    function parse () {
      var XMIParser = require('../../lib/editors/canonical_parser.js');

      var parsedData = XMIParser.parse({
        root: getRootElement(xmiText),
        databaseTypes: {
          contains: function (type) { return true; },
          getName: () => 'general'
        }
      });

      console.log(parsedData);
      function nest (object, into) {
        into.append(Object.keys(object).map(k => {
          var elt = object[k];
          var title =
              object.constructor === Array ? '' :
              k;
          var value;
          if (elt === null) {
            title += ':';
            value = $("<span/>").addClass("keyword").text("NULL");
          } else if (typeof elt === 'object') {
            if (elt.constructor === Array)
              title += ' (' + Object.keys(elt).length + ')';
            value = $("<ul/>");
            nest(elt, value);
          } else {
            if (object.constructor !== Array)
              title += ':';
            value = $("<span/>").addClass("scalar").text(elt);
          }
          into.append($("<li/>").text(title).append(value));
        }));
      }
      var ul = $("<ul/>");
      nest(parsedData, ul);
      collapse(ul);
      div.append(ul);
    }
    parse();
  }

  function getRootElement(content) {
    var root;
    var parser = new xml2js.Parser();
    parser.parseString(content, function (err, result) {
      if (err) {
        console.error(err);
      } else {
        if (result.hasOwnProperty('uml:Model')) {
          root = result['uml:Model'];
        } else if (result.hasOwnProperty('xmi:XMI')) {
          root = result['xmi:XMI']['uml:Model'][0];
        } else {
          throw new buildException(
            exceptions.NoRoot,
            'The passed document has no immediate root element.');
        }
      }
    });
    return root;
  }

  // collapsable list from <from> element
  function collapse (from) {
    from.find('li')
      .css('pointer','default')
      .css('list-style-image','none');
    from.find('li:has(ul)')
      .click(function(event){
	if (this == event.target) {
	  $(this).css('list-style-image',
		      (!$(this).children().is(':hidden')) ? 'url(plusbox.gif)' : 'url(minusbox.gif)');
	  $(this).children().toggle(TOGGLE_TIME);
	}
	return false;
      })
      .css({cursor:'pointer', 'list-style-image':'url(plusbox.gif)'})
      .children().hide();
    from.find('li:not(:has(ul))').css({cursor:'default', 'list-style-image':'none'});
    return from;
  };

};

window.onload = main;
