// Convert DDI XMI to OWL and ShEx

// Global configuration and control variables.
var TOGGLE_TIME = 50 // time in μsec to toggle collapsed lists.
var RENDER_DELAY = 10 // time to pause for display (horrible heuristics). Could try: .css('opacity', .99)
var BUILD_PRODUCTS = true // can disable if OWL and ShEx construction crashes.
var SUPPRESS_DUPLICATE_CLASSES = true // Don't list subclasses in parent's package.
var UPPER_UNLIMITED = '*'
const TYPE_NodeConstraint = ['NodeConstraint']
const TYPE_ShapeRef = ['ShapeRef']

function main () {
  let $ = window.jQuery

  let XSD = 'http://www.w3.org/2001/XMLSchema#'
  let UMLD = 'http://schema.omg.org/spec/UML/2.1/uml.xml#'
  let UMLP = 'http://www.omg.org/spec/UML/20110701/PrimitiveTypes.xmi#'

  const normalizeType = function (type) {
    if (!type) {
      return type // pass undefined on
    }
    if (type === 'xs:language') {
      return XSD + 'language'
    }
    let dtList = [
      { from: UMLD + 'String', to: XSD + 'string' },
      { from: UMLD + 'Integer', to: XSD + 'integer' },
      { from: UMLD + 'Boolean', to: XSD + 'boolean' },
      { from: UMLP + 'String', to: XSD + 'string' },
      { from: UMLP + 'Integer', to: XSD + 'integer' },
      { from: UMLP + 'Boolean', to: XSD + 'boolean' },
      { from: UMLP + 'Real', to: XSD + 'double' },
      { from: UMLP + 'UnlimitedNatural', to: XSD + 'double' }
    ]
    let dtMap = dtList.reduce(
      (acc, elt) => objSet(acc, elt.from, elt.to),
      {}
    )
    if (type in dtMap) {
      return dtMap[type]
    }
    if (type.startsWith(UMLP)) {
      return UMLD + type.substr(UMLP.length)
    }
    return type
  }
  const ParserOpts = {
    viewPattern: /FunctionalViews/,
    normalizeType: normalizeType,
    nameMap: {
      'Views (Exported from Drupal)': 'Views',
      'Class Model (Exported from Drupal)': 'ddi4_model',
      'ClassLibrary': 'ddi4_model', // minimize diffs
      'FunctionalViews': 'Views',
      'xsd:anyUri': 'http://www.w3.org/2001/XMLSchema#anyURI',
      'xsd:anguage': 'http://www.w3.org/2001/XMLSchema#language'
    }
  }
  const UMLparser = require('./canonical-uml-xmi-parser')(ParserOpts)

  function spanText (str) {
    return () => $('<span/>', { class: 'record' }).text(str)
  }

  const AllRecordTypes = [
    {type: UMLparser.ModelRecord,       maker: spanText('model'  )},
    {type: UMLparser.PropertyRecord,    maker: spanText('prop'   )},
    {type: UMLparser.ClassRecord,       maker: spanText('Class'  )},
    {type: UMLparser.PackageRecord,     maker: spanText('Package')},
    {type: UMLparser.EnumRecord,        maker: spanText('Enum'   )},
    {type: UMLparser.DatatypeRecord,    maker: spanText('Dt'     )},
    {type: UMLparser.ViewRecord,        maker: spanText('View'   )},
    {type: UMLparser.AssociationRecord, maker: spanText('Assoc'  )},
    {type: UMLparser.AssocRefRecord,    maker: spanText('assoc'  )},
    {type: UMLparser.RefereeRecord,     maker: spanText('ref'    )}
  ]

  $('#load-file').on('change', function (evt) {
    if (!window.FileReader) {
      return // not supported
    }
    for (let i = 0; i < evt.target.files.length; ++i) {
      (function (file) {
        // Give user some interface feedback before reading.
        let div = $('<div/>', {'id': file.name}).appendTo('#loaded')
        $('<li/>').append($('<a/>', {href: '#' + file.name}).text(file.name)).appendTo('#toc')
        let status = $('<span/>').addClass('status').text('loading...')
        $('<h2/>').append(file.name, status).appendTo(div)
        window.setTimeout(() => {
          let loader = new window.FileReader()
          loader.onload = function (loadEvent) {
            if (loadEvent.target.readyState !== 2) {
              console.dir(loadEvent)
              return
            }
            if (loadEvent.target.error) {
              window.alert('Error while reading file ' + file.name + ': ' + loadEvent.target.error)
              return
            }
            // This may take a long time to render.
            $('<textarea/>', {cols: 60, rows: 10}).val(loadEvent.target.result).appendTo(div)
            processXMI(loadEvent.target.result, 'uploaded ' + file.name + ' ' + new Date().toISOString(), status)
          }
          loader.readAsText(file)
        }, RENDER_DELAY)
      })(evt.target.files[i])
    }
  })

  $('#load-url').on('change', function (evt) {
    let source = $(this).val()
    // Give user some interface feedback before reading.
    let div = $('<div/>', {'id': source}).appendTo('#loaded')
    $('<li/>').append($('<a/>', {href: '#' + source}).text(source)).appendTo('#toc')
    let status = $('<span/>').addClass('status').text('fetching...')
    $('<h2/>').append(source, status).appendTo(div)
    window.fetch(source).then(function (response) {
      if (!response.ok) {
        throw Error('got ' + response.status + ' ' + response.statusText)
      }
      return response.text()
    }).then(function (text) {
      window.setTimeout(() => {
        $('<textarea/>', {cols: 60, rows: 10}).val(text).appendTo(div)
        processXMI(text, 'fetched ' + source + ' ' + new Date().toISOString(), status)
      }, RENDER_DELAY)
    }).catch(function (error) {
      div.append($('<pre/>').text(error)).addClass('error')
    })
    return true
  })

  function processXMI (umlText, source, status) {
    let div = $('<div/>', {'id': source, 'class': 'result'}).appendTo('#render')
    let reparse = $('<button/>').text('reparse').on('click', parseText)
    $('<h2/>').text(source).append(reparse).appendTo(div)
    let model
    let progress = $('<ul/>')
    div.append(progress)
    parseText()

    function parseText () {
      status.text('parsing JSON...')
      window.setTimeout(
        () => {
          // try JSON 'cause it's easier
          UMLparser.parseJSON(
            umlText, source,
            (err, result) => {
              if (err) {
                status.text('parsing UML...')
                window.setTimeout(
                  // fall back to XMI
                  () => UMLparser.parseXMI(umlText, source, parserCallback),
                  RENDER_DELAY
                )
              } else {
                parserCallback(err, result)
              }
            })
        },
        RENDER_DELAY
      )
    }

    function parserCallback (err, result) {
      if (err) {
        console.error(err)
      } else {
        model = result
        status.text('rendering structure...')
        window.setTimeout(render, RENDER_DELAY)
      }
    }

    function render () {
      let modelUL = $('<ul/>')
      structureToListItems(model, modelUL, AllRecordTypes)
      collapse(modelUL)
      progress.append($('<li/>').text('model').append(modelUL))

      status.text('diagnostics...')
      window.setTimeout(diagnostics, RENDER_DELAY)
    }

    function diagnostics () {
      let diagnostics = $('<ul/>')
      reusedProperties(model.classes, diagnostics)
      polymorphicProperties(model.properties, diagnostics)
      // puns(parsedData, diagnostics)
      let allViews = model.strip(model, source, model.views.map(v => v.name))
      console.log(Object.keys(model.classes).filter(k => !(k in allViews.classes)))
      collapse(diagnostics)

      progress.append($('<li/>').text('diagnostics').append(diagnostics))
      status.text('')
      status.text('export all formats...')
      window.setTimeout(exportAllFormats, RENDER_DELAY)
    }

    function exportAllFormats () {
      if (!BUILD_PRODUCTS) {
        return // skip format dump
      }
      let patched = UMLparser.duplicate(model)
      // Missing classes -- expected to be repaired.
      let missingClasses = ['CatalogItem', 'AnalyticMetadatum', 'CommonDataElement', 'DataCollection', 'LogicalResource', 'LogicalSegment', 'PhysicalSegment']
      missingClasses.forEach(
        classId => {
          if (!(classId in patched)) { // !!
            patched.classes[classId] = { name: classId, packages: ['FakePattern'] }
          }
        })

      let t = dumpFormats(patched, source,
                          $('#nestInlinableStructure').is(':checked'))
      progress.append(
        $('<li/>').append(
          'Raw model: ',
          $('<a/>', {href: ''}).text('JSON').on('click', () => download(JSON.stringify(model, null, 2), 'application/json', 'ddi-model.json'))
        ),
        $('<li/>').append(
          'OWL: ',
          $('<a/>', {href: ''}).text('XML').on('click', () => download(t.owlx.join('\n\n'), 'application/xml', 'ddi.xml')),
          ' | ',
          $('<a/>', {href: ''}).text('Manchester').on('click', () => download(t.owlm.join('\n\n'), 'text/plain', 'ddi.omn'))
        ),
        $('<li/>').append(
          'ShEx: ',
          $('<a/>', {href: ''}).text('Compact').on('click', () => download(t.shexc.join('\n\n'), 'text/shex', 'ddi.shex')),
          ' | ',
          $('<a/>', {href: ''}).text('HTML').on('click', () => download(t.shexh.join('\n\n'), 'text/html', 'ddi.shex.html'))
        )
      )

      console.log('model', model, Object.keys(model.classes).length, Object.keys(model.properties).length)
      model.views.map(v => v.name).forEach(
        viewName => {
          let s = model.strip(model, source, viewName,
                              $('#followReferencedClasses').is(':checked'),
                              $('#followReferentHierarchy').is(':checked'))
        }
      )
    }
  }

  function reusedProperties (classes, into) {
    const x = Object.keys(classes).reduce((acc, classId) => {
      classes[classId].properties.forEach(
        field => {
          if (!(field.name in acc.seen)) {
            acc.seen[field.name] = [classId]
          } else {
            acc.seen[field.name].push(classId)
            if (acc.duplicates.indexOf(field.name) === -1) {
              acc.duplicates.push(field.name)
            }
          }
        }
      )
      return acc
    }, {seen: {}, duplicates: []})
    into.append($('<li/>').append(
      $('<span/>',
        {title: 'names of properties which are used in more than one class'})
        .text('reused properties'),
      ' (' + x.duplicates.length + ')',
      $('<ul/>').append(
        x.duplicates.sort(
          // sort first by number of duplicates, otherwise by name
          (l, r) => x.seen[r].length - x.seen[l].length || l.localeCompare(r)
        ).map(dupe => {
          return $('<li/>').append(
            $('<span/>').text(dupe).addClass('scalar'),
            ' (' + x.seen[dupe].length + ')',
            $('<ul/>').append(
              x.seen[dupe].map(lookIn => $('<li/>').append(
                $('<a/>', { href: docURL(lookIn) }).text(lookIn)
              ))
            ))
        })
      )))
  }

  function polymorphicProperties (properties, into) {
    let x = Object.keys(properties).filter(
      propName =>
        properties[propName].uniformType.length !== 1 ||
        properties[propName].uniformType[0] === undefined
    )
    into.append($('<li/>').append(
      $('<span/>',
        {title: 'names of properties which have more than one type'})
        .text('polymorphic properties'),
      ' (' + x.length + ')',
      $('<ul/>').append(
        x.sort(
          (l, r) => properties[r].uniformType.length - properties[l].uniformType.length
        ).map(dupe => {
          return $('<li/>').append(
            dupe,
            ' (' + properties[dupe].uniformType.length + ')',
            $('<ul/>').append(
              properties[dupe].uniformType.map(lookIn => $('<li/>').append(
                lookIn
                  ? $('<a/>', { href: docURL(lookIn) }).text(lookIn)
                  : $('<span/>').text('no stated type').addClass('scalar')
              ))
            ))
        })
      )))
  }

  function dumpFormats (model, source, nestInlinableStructure) {
    let owlx = [
      '<?xml version="1.0"?>\n' +
        '<!-- Source: ' + source + ' -->\n' +
        '<Ontology xmlns="http://www.w3.org/2002/07/owl#"\n' +
        '     xml:base="http://ddi-alliance.org/ns/ddi4"\n' +
        '     xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"\n' +
        '     xmlns:xml="http://www.w3.org/XML/1998/namespace"\n' +
        '     xmlns:xsd="http://www.w3.org/2001/XMLSchema#"\n' +
        '     xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"\n' +
        '     ontologyIRI="http://ddi-alliance.org/ns/ddi4">\n' +
        '    <Prefix name="dc" IRI="http://purl.org/dc/elements/1.1/"/>\n' +
        '    <Prefix name="ddi" IRI="http://ddi-alliance.org/ns/#"/>\n' +
        '    <Prefix name="owl" IRI="http://www.w3.org/2002/07/owl#"/>\n' +
        '    <Prefix name="rdf" IRI="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/>\n' +
        '    <Prefix name="xml" IRI="http://www.w3.org/XML/1998/namespace"/>\n' +
        '    <Prefix name="xsd" IRI="http://www.w3.org/2001/XMLSchema#"/>\n' +
        '    <Prefix name="rdfs" IRI="http://www.w3.org/2000/01/rdf-schema#"/>\n'
    ]
    let owlm = [
      'Prefix: ddi: <http://ddi-alliance.org/ns/#>\n' +
        'Prefix: xsd: <http://www.w3.org/2001/XMLSchema#>\n' +
        'Prefix: rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n' +
        'Ontology: <http://ddi-alliance.org/ddi-owl>\n' +
        '\n'
    ]
    let shexc = [
      '# Source: ' + source + '\n' +
        'PREFIX ddi: <http://ddi-alliance.org/ns/#>\n' +
        'PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>\n' +
        'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n' +
        'PREFIX shexmi: <http://www.w3.org/ns/shex-xmi#>\n' +
        'PREFIX mark: <https://github.com/commonmark/commonmark.js>\n' +
        '\n'
    ]
    let shexh = []

    function OWLXMLMarkup () {
      return {
        // only needed for section markers
        startPackage: function (p) { return '    <!-- START ' + p.name + ' Package -->\n' },
        endPackage: function (p) { return '\n    <!-- END ' + p.name + ' Package -->\n' }
      }
    }
    function stringEscape (str) {
      return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    }
    function ShExCMarkup () {
      return {
        definition: (rec) => (rec.isAbstract ? 'ABSTRACT ' : '') + pname(rec.name),
        docLink: link => '// rdfs:definedBy <' + link + '>',
        packageStr: pkg => '// shexmi:package "' + stringEscape(pkg) + '"',
        aggregation: agg => '// shexmi:partonomy "' + (agg === UMLparser.Aggregation.shared ? "shexmi:sharedAggregation" : agg === UMLparser.Aggregation.composite ? "shexmi:compositeAggregation" : "\"???\"") + '"',
        comment: txt => '// shexmi:comment """' + stringEscape(txt) + '"""',
        reference: name => pname(name),
        constant: name => pname(name),
        property: name => pname(name),
        valueType: name => pname(name),
        valueReference: name => name === '.' ? '.' : '@' + pname(name),
        startPackage: function (p) { return '# START ' + p.name + ' Package\n' },
        endPackage: function (p) { return '\n# END ' + p.name + ' Package\n' }
      }
    }
    function ShExHMarkup (model) {
      return {
        definition: (rec) => `      <section>
        <h3>${rec.name}</h3>
        <div>
          <p>${rec.referees.length === 0 ? 'no references' : '' + rec.referees.length + ' reference' + (rec.referees.length > 1 ? 's' : '') + ':'}</p>
          ${rec.referees.length ? `<div class="left-scroll"><ul class="referees">
${rec.referees.map(r => `            <li><a>${finalReferee(r.classId).name}</a> ${r.propName}</li>\n`).join('')}
          </ul></div>` : ''}
        </div>
        <div class="example wrapper">
        <pre class="nohighlight schema shexc tryable">
${rec.isAbstract ? 'ABSTRACT ' : ''}<span class="shape-name">ddi:<dfn>${rec.name}</dfn></span>`,
        docLink: link => `<a class="tryit" href="${link}"></a></pre>
      </div>
      </section>`,
        packageStr: pkg => '',
        aggregation: agg => '',
        comment: txt => '',
        reference: name => ref(pname(name)),
        constant: name => pOrT(pname(name)),
        property: name => pOrT(pname(name)),
        valueType: name => pOrT(pname(name)),
        valueReference: name => name === '.' ? '.' : '@' + ref(pname(name)),
        startPackage: function (p) { return '    <section>\n      <h2>' + p.name + '</h2>\n\n' },
        endPackage: function (p) { return '\n    </section>\n' }
      }

      function finalReferee (classId) {
        while (nestInlinableStructure && inlineable(model, model.classes[classId])) {
          if (classId === model.classes[classId].referees[0].classId) {
            break
          }
          classId = model.classes[classId].referees[0].classId
        }
        return model.classes[classId]
      }

      function ref (term) {
        let i = term.indexOf(':') + 1
        return '<span class="shape-name">' + term.substr(0, i) + '<a>' + term.substr(i) + '</a></span>'
      }

      function pOrT (term) {
        let i = term.indexOf(':') + 1
        return '<span class="type">' + term.substr(0, i) + '</span><span class="constant">' + term.substr(i) + '</span>'
      }
    }

    let packages = firstBranch(model.packageHierarchy.roots)

    let toRender = [
      { v: owlx, s: OWLXMLSerializer(model), m: OWLXMLMarkup() },
      { v: shexc, s: ShExCSerializer(model, nestInlinableStructure), m: ShExCMarkup() },
      { v: shexh, s: ShExCSerializer(model, nestInlinableStructure), m: ShExHMarkup(model) }
    ]
    toRender.forEach(
      r => {
        Array().push.apply(r.v, Object.keys(packages)/*.filter(
          packageId => !packages[packageId].name.match(/Pattern/)
        )*/.map(
          packageId => renderPackage(model.packages[packageId], r.s, r.m)
        ))
      })

    // Render package hierarchy.
    Array().push.apply(owlx, Object.keys(packages).map(
      p => `    <SubClassOf>
        <Class abbreviatedIRI="ddi:${model.packages[p].name}_Package"/>
        <Class abbreviatedIRI="ddi:Packages"/>
    </SubClassOf>`
    ))

    // Render view hierarchy.
    if ('views' in model) {
      Array().push.apply(owlx, model.views.reduce(
        (acc, view) => acc.concat([`    <SubClassOf>
        <Class abbreviatedIRI="ddi:${view.name}"/>
        <Class abbreviatedIRI="ddi:Views"/>
    </SubClassOf>`], view.members.map(
          member => `    <SubClassOf>
        <Class abbreviatedIRI="ddi:${model.classes[member].name}"/>
        <Class abbreviatedIRI="ddi:${view.name}"/>
    </SubClassOf>`
        )), []
      ))
    }

    // Declare properties
    Array().push.apply(owlx, Object.keys(model.properties).filter(propName => !(isPolymorphic(propName))).map(
      propName => {
        let p = model.properties[propName]
        let t = isObject(p, model) ? 'Object' : 'Data'
        let src = p.sources[0]
        let dt = isObject(p, model)
          ? src.idref in model.classes ? model.classes[src.idref] : model.enums[src.idref]
          : src.idref in model.datatypes ? model.datatypes[src.idref] : { name: src.href }
        return `    <Declaration>
        <${t}Property abbreviatedIRI="ddi:${propName}"/>
    </Declaration>
    <${t}PropertyRange>
        <${t}Property abbreviatedIRI="ddi:${propName}"/>
        <${isObject(p, model) ? "Class" : "Datatype"} abbreviatedIRI="${pname(dt.name)}"/>
    </${t}PropertyRange>`
      }
    ))

    Array().push.apply(owlm, Object.keys(model.properties).filter(propName => !(isPolymorphic(propName))).map(
      propName => {
        let p = model.properties[propName]
        let t = isObject(p, model) ? 'Object' : 'Data'
        return t + 'Property: ddi:' + propName + ' Range: ' + pname(p.uniformType[0])
      }
    ))

    Array().push.apply(owlm, Object.keys(model.classes).filter(
      classId => !model.classes[classId].packages[0].match(/Pattern/)
    ).map(
      classId => 'Class: ddi:' + classId + ' SubClassOf:\n' +
        model.classes[classId].properties.map(
          propertyRecord => {
            let propName = propertyRecord.name
            let type = isPolymorphic(propName) ? 'owl:Thing' : pname(model.properties[propName].uniformType[0])
            return '  ddi:' + propName + ' only ' + type
          }
        ).join(',\n')
    ))

    // Terminate the various forms:
    Array().push.apply(owlx, [
      '</Ontology>\n'
    ])
    let ret = {owlx: owlx, owlm: owlm, shexc: shexc, shexh: shexh}
    console.dir(ret)
    return ret

    function isPolymorphic (propName) {
      return model.properties[propName].uniformType.length !== 1 ||
        model.properties[propName].uniformType[0] === undefined
    }

    function renderPackage (pkg, serializer, markup) {
      return markup.startPackage(pkg) +
        pkg.elements.map(
          entry => {
            switch (entry.type) {
              // Not needed since the package space is flat:
              // case 'package':
              //   return model.packages[entry.id].map(
              //     packageId => renderPackage(packageId, serializer, markup)
              //   ).join('\n')
              //   break
              case 'class':
                return serializer.class(model, entry.id, markup)
              case 'enumeration':
                return serializer.enum(model, entry.id, markup)
              case 'datatype':
                return serializer.datatype(model, entry.id, markup)
              default:
                throw Error('need renderPackage handler for ' + entry.type)
            }
          }
        ).join('\n\n') +
        markup.endPackage(pkg)
    }
  }

  function OWLXMLSerializer (model) {
    return {
      class: OWLXMLClass,
      enum: OWLXMLEnum,
      datatype: OWLXMLDatatype
    }

    function isPolymorphic (propName) {
      return model.properties[propName].uniformType.length !== 1 ||
        model.properties[propName].uniformType[0] === undefined
    }

    function OWLXMLClass (model, classId) {
      return `    <Declaration>
        <Class abbreviatedIRI="ddi:${model.classes[classId].name}"/>
    </Declaration>\n` +
        (model.classes[classId].isAbstract ? (
          `    <DisjointUnion>
        <Class abbreviatedIRI="ddi:${model.classes[classId].name}"/>\n` + (model.classHierarchy.children[classId] || []).map(
            childClassId =>
              `        <Class abbreviatedIRI="ddi:${model.classes[childClassId].name}"/>\n`
          ).join('') +
          `    </DisjointUnion>\n`
        ) : '') +
        model.classes[classId].properties
        // .filter( propertyRecord => !(isPolymorphic(propertyRecord.name)) )
        .map(
          propertyRecord => {
            let propName = propertyRecord.name
            let p = model.properties[propName]
            let t = isObject(p, model) ? 'Object' : 'Data'
            let dt = isObject(p, model)
              ? propertyRecord.idref in model.classes ? model.classes[propertyRecord.idref] : model.enums[propertyRecord.idref]
              : propertyRecord.idref in model.datatypes ? model.datatypes[propertyRecord.idref] : { name: propertyRecord.href }
            let type = isPolymorphic(propName) ? 'owl:Thing' : pname(dt.name)
            return `    <SubClassOf>
        <Class abbreviatedIRI="ddi:${model.classes[classId].name}"/>
        <${t}AllValuesFrom>
            <${t}Property abbreviatedIRI="ddi:${propName}"/>
            <${isObject(p, model) ? "Class" : "Datatype"} abbreviatedIRI="${type}"/>
        </${t}AllValuesFrom>
    </SubClassOf>`
          }
        ).concat(
          (model.classes[classId].superClasses).map(
            superClass =>
              `    <SubClassOf>
        <Class abbreviatedIRI="ddi:${model.classes[classId].name}"/>
        <Class abbreviatedIRI="ddi:${model.classes[superClass].name}"/>
    </SubClassOf>`
          )
        ).concat(
          model.classes[classId].superClasses.find(
            supercl =>
              SUPPRESS_DUPLICATE_CLASSES && // if some superclass appears in the same package...
              model.classes[classId].packages[0] === model.classes[supercl].packages[0]
          )
            ? [] //       ... skip that package
            : [`    <SubClassOf>
        <Class abbreviatedIRI="ddi:${model.classes[classId].name}"/>
        <Class abbreviatedIRI="ddi:${model.packages[model.classes[classId].packages[0]].name}_Package"/>
    </SubClassOf>`
            ]).concat(
          (model.classes[classId].comments).map(
            comment =>
              `    <AnnotationAssertion>
        <AnnotationProperty abbreviatedIRI="rdfs:comment"/>
        <AbbreviatedIRI>ddi:${model.classes[classId].name}</AbbreviatedIRI>
        <Literal datatypeIRI="http://www.w3.org/1999/02/22-rdf-syntax-ns#PlainLiteral">${encodeCharData(trimMarkdown(comment))}</Literal>
    </AnnotationAssertion>`
          )
        ).join('\n')
    }

    function encodeCharData (text) {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    }

    function OWLXMLEnum (model, enumId) {
      return [].concat(
        `    <EquivalentClasses>
        <Class abbreviatedIRI="ddi:${model.enums[enumId].name}"/>
        <ObjectOneOf>`,
        model.enums[enumId].values.map(
          v => `            <NamedIndividual abbreviatedIRI="ddi:${v}"/>`
        ),
        `        </ObjectOneOf>
    </EquivalentClasses>
    <SubClassOf>
        <Class abbreviatedIRI="ddi:${model.enums[enumId].name}"/>
        <Class abbreviatedIRI="ddi:${model.packages[model.enums[enumId].packages[0]].name}_Package"/>
    </SubClassOf>`).join('\n')
    }

    function OWLXMLDatatype (model, datatypeId) {
      let dt = model.datatypes[datatypeId]
      if (dt.name.startsWith(XSD) ||
          dt.name.startsWith('http://www.w3.org/XML/1998/namespace#')) {
        return ''
      }
      return [].concat(
        `    <DatatypeDefinition>
        <Datatype abbreviatedIRI="${pname(dt.name)}"/>
        <Datatype abbreviatedIRI="xsd:string"/>
    </DatatypeDefinition>`).join('\n')
    }
  }

  function inlineable (model, classRecord) {
    return classRecord.referees.length === 1
      && (!(classRecord.id in model.classHierarchy.children)
          || model.classHierarchy.children[classRecord.id].length === 0)
  }

  function trimMarkdown (md) {
    return md.replace(/^[^ \t].*\n=+\n\n/mg, '').trim()
  }

  function ShExCSerializer (model, nestInlinableStructure) {
    return {
      class: ShExCClass,
      enum: ShExCEnum,
      datatype: ShExCDatatype
    }

    function ShExCClass (model, classId, markup, force) {
      let classRecord = model.classes[classId]
      if (!force && nestInlinableStructure && inlineable(model, classRecord)) {
        return ''
      }
      return (force
              ? ''
              : markup.definition(classRecord)) +
        classRecord.superClasses.map(
          su => model.classes[su].name
        ).map(
          name => ' EXTENDS ' + markup.reference(name)
        ).join('') +
        ' {\n' +
        classRecord.properties.map(
          propertyRecord => {
            let propName = propertyRecord.name
            let p = model.properties[propName]
            let use = p.sources.find(s => s.id.indexOf(classId) === 0)
            let dt = isObject(p, model)
              ? use.idref in model.classes ? model.classes[use.idref] : model.enums[use.idref]
              : use.idref in model.datatypes ? model.datatypes[use.idref] : { name: use.href }
            if (dt === undefined) {
              console.warn('unresolved datatype ' + use.idref + ' for property ' + propName)
              dt = {name: '.'} // replace with a ShExC wildcard to keep the schema coherent.
            }
            let card = shexCardinality(use)
            if (use.aggregation)
              console.log(use.aggregation, UMLparser.Aggregation.shared, use.aggregation === UMLparser.Aggregation.shared);
            let comments = (use.comments || []).map(markup.comment)
            let aggregations = use.aggregation ? [markup.aggregation(use.aggregation)] : []
            let valueStr =
                  'referees' in dt && dt instanceof UMLparser.ClassRecord && nestInlinableStructure && inlineable(model, dt)
                  ? indent(ShExCClass(model, dt.id, markup, true), '  ')
                  : isObject(p, model)
                  ? markup.valueReference(dt.name)
                  : markup.valueType(dt.name)
            return '  ' + markup.property(propName) + ' ' + valueStr +
              (card ? ' ' + card : '') +
              comments.map(
                comment => '\n  ' + comment
              ).join('') +
              aggregations.map(
                aggregation => '\n  ' + aggregation
              ).join('') + ';\n'
          }
        ).join('') + '}' +
        (force ? '' : '\n' + markup.docLink(docURL(classRecord.name))) +
        (force || classRecord.packages.length === 0 ? '' : '\n' + markup.packageStr(model.packages[classRecord.packages[0]].name)) +
        (force || classRecord.comments.length === 0 ? '' : '\n' + markup.comment(trimMarkdown(classRecord.comments[0])) + '^^mark:')

      function indent (s, lead) {
        let a = s.split(/\n/)
        return a[0].replace(/^ /, '') + '\n'
          + a.slice(1, a.length - 1).map(
            line => line.replace(/^/g, lead) + '\n'
          ).join('')
          + lead + a[a.length - 1]
      }
    }

    function ShExCEnum (model, enumId, markup) {
      return markup.definition(model.enums[enumId]) + ' [\n' + model.enums[enumId].values.map(
        v => '  ' + markup.constant(v) + '\n'
      ).join('') + ']' + '\n' + markup.docLink(docURL(model.enums[enumId].name))
    }

    function ShExCDatatype (model, datatypeId, markup) {
      let dt = model.datatypes[datatypeId]
      if (dt.name.startsWith(XSD) ||
          dt.name.startsWith('http://www.w3.org/XML/1998/namespace#')) {
        return ''
      }
      return markup.definition(dt) + ' xsd:string' + '\n' + markup.docLink(docURL(dt.name))
    }

    function shexCardinality (propertyRecord) {
      let lower = parseInt(propertyRecord.lower || 0)
      let upper = propertyRecord.upper && propertyRecord.upper !== '*' ? parseInt(propertyRecord.upper) : -1
      if (lower === 1 && upper === 1) {
        return ''
      } else if (lower === 1 && upper === -1) {
        return '+'
      } else if (lower === 0 && upper === -1) {
        return '*'
      } else if (lower === 0 && upper === 1) {
        return '?'
      } else {
        return '{' + lower + ',' + (upper === -1 ? '' : upper) + '}'
      }
    }
  }

  function isObject (propertyDecl, model) {
    return !!propertyDecl.sources[0].idref &&
      !(propertyDecl.sources[0].idref in model.datatypes)
  }

  const KnownPrefixes = [
    {url: XSD, prefix: 'xsd'},
    {url: XSD, prefix: 'xs'},
    {url: UMLD, prefix: 'umld'},
    {url: 'http://www.w3.org/XML/1998/namespace#', prefix: 'xhtml'},
    {url: UMLP, prefix: 'umlp'}
  ]

  function pname (id) {
    let ret = KnownPrefixes.map(
      pair =>
        id.startsWith(pair.url)
          ? pair.prefix + ':' + id.substr(pair.url.length)
          : null
    ).find(v => v)
    if (ret) {
      return ret
    }
    if (id.startsWith('http:')) {
      console.warn('need namespace for ' + id)
    }
    return 'ddi:' + id
  }

  /* Hack to deal with this special idiom:
     <ownedAttribute xmi:type="uml:Property" name="language" xmi:id="LanguageSpecificStructuredStringType_language">
     <type xmi:type="xs:language"/>
     </ownedAttribute>
  */

  function puns (object, into) {
    const lookIns = ['classes', 'fields', 'associations', 'types', 'enums']
    const x = lookIns.reduce((acc, lookIn) => {
      Object.keys(object[lookIn]).forEach(
        name => {
          if (!(name in acc.seen)) {
            acc.seen[name] = [lookIn]
          } else {
            acc.seen[name].push(lookIn)
            if (acc.duplicates.indexOf(name) === -1) {
              acc.duplicates.push(name)
            }
          }
        }
      )
      return acc
    }, {seen: {}, duplicates: []})
    into.append($('<li/>').append(
      $('<span/>',
        {title: 'names which appear in any two of ' + lookIns})
        .text('puns'),
      ' (' + x.duplicates.length + ')',
      $('<ul/>').append(
        x.duplicates.map(dupe => {
          return $('<li/>').append(
            $('<span/>').text(dupe).addClass('scalar'),
            $('<ul/>').append(
              x.seen[dupe].map(lookIn => $('<li/>').text(lookIn))
            ))
        })
      )))
  }

  function structureToListItems (object, into, recordTypes) {
    into.append(Object.keys(object).filter(
      k => typeof object[k] !== 'function'
    ).map(k => {
      let elt = object[k]
      let typeIcon = ''
      let title = object.constructor === Array
        ? ''
        : k
      let value
      if (elt === null) {
        title += ':'
        value = $('<span/>').addClass('keyword').text('NULL')
      } else if (typeof elt === 'boolean') {
        title += ':'
        value = $('<span/>').addClass('keyword').text(elt)
      } else if (typeof elt === 'object') {
        let delims = ['{', '}']
        if (elt.constructor === Array) {
          let delims = ['[', ']']
        } else if ('id' in elt) {
          if (title === '') {
            title = elt.id
          } else if (title !== elt.id) {
            console.log("differ: " + title + ' != ' + elt.id)
            // title += ' ' + 'id=' + elt.id
          }
        } else if ('$' in elt && 'xmi:id' in elt.$) {
          title += elt.$['xmi:id']
        }
        typeIcon = recordTypes.find(rt => elt instanceof rt.type)
        if (typeIcon === undefined) {
          typeIcon = ''
          title += ' ' + delims[0] + Object.keys(elt).length + delims[1]
        } else {
          typeIcon = typeIcon.maker()
        }
        value = $('<ul/>')
        structureToListItems(elt, value, recordTypes)
      } else {
        if (object.constructor !== Array) {
          title += ':'
        }
        value = !elt
          ? ''
          : $(elt.match(/\n/) ? '<pre/>' : '<span/>').addClass('scalar').text(elt)
      }
      into.append($('<li/>').append(typeIcon, title, value))
    }))
  }

  // collapsable list from <from> element
  function collapse (from) {
    from.find('li')
      .css('pointer', 'default')
      .css('list-style-image', 'none')
    from.find('li:has(ul)')
      .click(function (event) {
        if (this === event.target) {
          $(this).css(
            'list-style-image',
            (!$(this).children('ul').is(':hidden')) ? 'url(plusbox.gif)' : 'url(minusbox.gif)'
          )
          $(this).children('ul').toggle(TOGGLE_TIME)
          return false
        } else {
          return true
        }
      })
      .css({cursor: 'pointer', 'list-style-image': 'url(plusbox.gif)'})
      .children('ul').hide()
    from.find('li:not(:has(ul))').css({cursor: 'default', 'list-style-image': 'none'})
    return from
  }

  function download (data, mediaType, filename) {
    let blob = new window.Blob([data], {type: mediaType})
    let e = document.createEvent('MouseEvents')
    let a = document.createElement('a')

    a.download = filename
    a.href = window.URL.createObjectURL(blob)
    a.dataset.downloadurl = ['text/json', a.download, a.href].join(':')
    e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null)
    a.dispatchEvent(e)
    return false
  }

  // functional add key/val to object.
  function addKey (obj, prop, val) {
    let toAdd = {}
    toAdd[prop] = val
    return Object.assign({}, obj, toAdd)
  }

  function deepCopy (obj) {
    return JSON.parse(JSON.stringify(obj)) // startlingly efficient
  }

  function emptyObject (obj) {
    for (var x in obj) { return false }
    return true
  }

  // Find the first nested object which has multiple children.
  function firstBranch (root) {
    while (Object.keys(root).length === 1) {
      root = root[Object.keys(root)[0]]
    }
    return root
  }

  function docURL (term) {
    return 'http://lion.ddialliance.org/ddiobjects/' + term.toLowerCase()
  }

  // stupid stuff you always have to add to javascript
  function objSet (obj, key, value) {
    let add = { }
    add[key] = value
    return Object.assign({}, obj, add)
  }

}

window.onload = main
