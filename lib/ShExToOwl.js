let ShExToOwl = function (schema, options = {}) {
  const SHEXMI = 'http://www.w3.org/ns/shex-xmi#'
  const XSD = 'http://www.w3.org/2001/XMLSchema#'

  // populate shapeHierarchy
  let shapeHierarchy = makeHierarchy()
  Object.keys(schema.shapes).forEach(label => {
    let shapeExpr = skipDecl(schema.shapes[label])
    if (shapeExpr.type === 'Shape') {
      (shapeExpr.extends || []).forEach(
        superShape => shapeHierarchy.add(superShape, label)
      )
    }
  })
  Object.keys(schema.shapes).forEach(label => {
    if (!(label in shapeHierarchy.parents))
      shapeHierarchy.parents[label] = []
  })

  // compile predicate list
  let untyped = {}
  let predicates = getPredicateUsage(schema) // IRI->{ uses: [label], commonType: shapeExpr }
  if ('errors' in options) {
    options.errors.untyped = untyped
  }

  return dumpFormats(schema, true, true)

  function getPredicateUsage (schema) {
    let predicates = { } // IRI->{ uses: [shapeLabel], commonType: shapeExpr }
    Object.keys(schema.shapes).forEach(shapeLabel => {
      let shapeExpr = skipDecl(schema.shapes[shapeLabel])
      if (shapeExpr.type === 'Shape') {
        let tcs = simpleTripleConstraints(shapeExpr) || []
        tcs.forEach(tc => {
          let newType = getValueType(tc.valueExpr)
          if (!(tc.predicate in predicates)) {
            predicates[tc.predicate] = {
              uses: [shapeLabel],
              commonType: newType,
              polymorphic: false
            }
          } else {
            predicates[tc.predicate].uses.push(shapeLabel)
            let curType = predicates[tc.predicate].commonType
            if (curType === null) {
              // another use of a predicate with no commonType
              // console.warn(`${shapeLabel} ${tc.predicate}:${newType} uses untypable predicate`)
              untyped[tc.predicate].references.push({ shapeLabel, newType })
            } else if (curType === newType) {
              ; // same type again
            } else if (shapeHierarchy.parents[curType].indexOf(newType) !== -1) {
              predicates[tc.predicate].polymorphic = true; // already covered by current commonType
            } else {
              let idx = shapeHierarchy.parents[newType].indexOf(curType)
              if (idx === -1) {
                let intersection = shapeHierarchy.parents[curType].filter(
                  lab => -1 !== shapeHierarchy.parents[newType].indexOf(lab)
                )
                if (intersection.length === 0) {
                  untyped[tc.predicate] = {
                    shapeLabel,
                    predicate: tc.predicate,
                    curType,
                    newType,
                    references: []
                  }
                  // console.warn(`${shapeLabel} ${tc.predicate} : ${newType} isn\'t related to ${curType}`)
                  predicates[tc.predicate].commonType = null
                } else {
                  predicates[tc.predicate].commonType = intersection[0]
                  predicates[tc.predicate].polymorphic = true
                }
              } else {
                predicates[tc.predicate].commonType = shapeHierarchy.parents[newType][idx]
                predicates[tc.predicate].polymorphic = true
              }
            }
          }
        })
      }
    })
    return predicates
  }

  function dumpFormats (schema, nestInlinableStructure, chattyOWL) {
    let source = options.source

    let owlx = [
      '<?xml version="1.0"?>\n' +
        '<!-- ' + source.resource + '\n' +
        '     ' + source.method + ' ' + source.timestamp + (
          source.viewLabels ? source.viewLabels.map(
            l => '\n       ' + l
          ) : ''
        ) + ' -->\n' +
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
        '# ' + source.resource + '\n' +
        '# ' + source.method + ' ' + source.timestamp + (
          source.viewLabels ? source.viewLabels.map(
            l => '\n#   ' + l
          ) : ''
        ) + '\n' +
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
        startPackage: function (p) { return '    <!-- START ' + p.name + ' Package -->' },
        endPackage: function (p) { return '    <!-- END ' + p.name + ' Package -->\n\n' }
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
        aggregation: agg => '// shexmi:partonomy "' + agg + '"',
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

    let curPackage = null
    let toRender = [
      { v: owlx, s: OWLXMLSerializer(schema, chattyOWL), m: OWLXMLMarkup() },
      // { v: shexc, s: ShExCSerializer(schema, nestInlinableStructure), m: ShExCMarkup() },
      // { v: shexh, s: ShExCSerializer(schema, nestInlinableStructure), m: ShExHMarkup(schema) }
    ]
    toRender.forEach(
      r => {
        Array().push.apply(r.v, Object.keys(schema.shapes).map(
          shapeLabel => renderShapeExpr(shapeLabel, schema.shapes[shapeLabel], r.s, r.m)
        ).concat(curPackage
                 ? r.m.endPackage({name: curPackage})
                 : []))
        curPackage = null
      })
/*
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
        ), view.comments.map(
            comment =>
              `    <AnnotationAssertion>
        <AnnotationProperty abbreviatedIRI="rdfs:comment"/>
        <AbbreviatedIRI>ddi:${view.name}</AbbreviatedIRI>
        <Literal datatypeIRI="http://www.w3.org/1999/02/22-rdf-syntax-ns#PlainLiteral">${encodeCharData(trimMarkdown(comment))}</Literal>
    </AnnotationAssertion>`
          )
        ), []
      ))
    }
*/


    // Declare properties
    Array().push.apply(owlx, Object.keys(predicates).map(
      propName => {
        let p = predicates[propName]
        if (p.commonType === null || isPolymorphic(propName)) {
          let msg = `skipping ${propName} with no common type`
          // console.warn(msg)
          return `    <!-- ${msg} -->`
        }
        let fakeRef = schema.shapes[p.commonType] || {type: 'NodeConstraint', datatype: p.commonType} // forge a ShapeRef
        let t = isObject(fakeRef) ? 'Object' : 'Data'
        return `    <Declaration>
        <${t}Property abbreviatedIRI="${pname(propName)}"/>
    </Declaration>
    <${t}PropertyRange>
        <${t}Property abbreviatedIRI="${pname(propName)}"/>
        <${isObject(fakeRef) ? "Class" : "Datatype"} abbreviatedIRI="${pname(p.commonType)}"/>
    </${t}PropertyRange>`
      }
    ))


/*
    Array().push.apply(owlm, Object.keys(model.properties).filter(
      propName => propName !== 'realizes' && !(isPolymorphic(propName))
    ).map(
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
        model.classes[classId].properties.filter(
          propName => propName !== 'realizes'
        ).map(
          propertyRecord => {
            let propName = propertyRecord.name
            let type = isPolymorphic(propName) ? 'owl:Thing' : pname(model.properties[propName].uniformType[0])
            return '  ddi:' + propName + ' only ' + type
          }
        ).join(',\n')
    ))
*/
    // Terminate the various forms:
    if (options.append) {
      Array().push.apply(owlx, [
        options.append
      ])
    }
    Array().push.apply(owlx, [
      '</Ontology>\n'
    ])
    let ret = {owlx: owlx.join('\n\n'), owlm: owlm, shexc: shexc, shexh: shexh}
    return ret

    function renderShapeExpr (shapeLabel, shapeExpr, serializer, markup) {
      let ret = []
      let abstract = false, restricts = []
      if (shapeExpr.type === 'ShapeDecl') {
        if ('abstract' in shapeExpr) { abstract = shapeExpr.abstract }
        if ('restricts' in shapeExpr) { restricts = shapeExpr.restricts }
        shapeExpr = shapeExpr.shapeExpr
      }
      let pkg = getPackage(shapeExpr)
      if (pkg) {
        let v = pname(pkg) || pkg
        if (v !== curPackage) {
          if (curPackage) {
            ret.push(markup.endPackage({name: curPackage}))
          }
          curPackage = v
          ret.push(markup.startPackage({name: curPackage}))
        }
      }
            switch (shapeExpr.type) {
              case 'Shape':
                ret.push(serializer.class(shapeLabel, shapeExpr, markup, abstract, restricts))
                break
              case 'NodeConstraint':
                if ('values' in shapeExpr) {
                  ret.push(serializer.enum(shapeLabel, shapeExpr, markup))
                } else if ('datatype' in shapeExpr || 'nodeKind' in shapeExpr) {
                  ret.push(serializer.datatype(shapeLabel, shapeExpr, markup))
                } else {
                  throw Error('no serializer for NodeConstraint ' + JSON.stringify(shapeExpr))
                }
                break
              default:
                throw Error('need renderShapeExpr handler for ' + shapeExpr.type)
            }
      return ret.join('\n')
    }
  }

  function getPackage (shapeExpr) {
    let a = (shapeExpr.annotations || []).find(a => a.predicate === SHEXMI + 'package')
    return a ? a.object.value : null
  }

  function getComments (expr) { // shapeExpr or tripleExpr
    return (expr.annotations || []).filter(
      a => a.predicate === SHEXMI + 'comment'
    ).map(
      c => c.object.value
    )
  }

  function skipDecl (shapeExpr) {
    return shapeExpr.type === 'ShapeDecl' ? shapeExpr.shapeExpr : shapeExpr
  }

    function encodeCharData (text) {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    }

  function OWLXMLSerializer (model, chatty) {
    let allProperty = []
    return {
      class: OWLXMLClass,
      enum: OWLXMLEnum,
      datatype: OWLXMLDatatype
    }

    function OWLXMLClass (label, shape, markup, abstract, restricts) {
      return []
        .concat(`    <Declaration>
        <Class abbreviatedIRI="${pname(label)}"/>
    </Declaration>` +
        (abstract ? (
          `\n    <DisjointUnion>
        <Class abbreviatedIRI="${pname(label)}"/>\n` + (shapeHierarchy.children[label] || []).map(
            childShapeLabel =>
              `        <Class abbreviatedIRI="${pname(childShapeLabel)}"/>\n`
          ).join('') +
          `    </DisjointUnion>`
        ) : ''))
        .concat(simpleTripleConstraints(shape).map(
          tripleConstraint => {
            let propName = tripleConstraint.predicate
            if (!('valueExpr' in tripleConstraint)) {
              let msg = `skipping ${label}'s ${propName} with no valueExpr -- can't know if it's an object or data property`
              console.warn(msg)
              return `<!-- ${msg} -->`
            }
            let t = isObject(tripleConstraint.valueExpr) ? 'Object' : 'Data' // what if null?
            let type = /* !! remove test */isPolymorphic(propName) ? 'owl:Thing' : pname(getValueType(tripleConstraint.valueExpr))
            let lower = parseInt(tripleConstraint.min || '0')
            let upper = tripleConstraint.max && tripleConstraint.max !== '*' ? parseInt(tripleConstraint.max) : -1
            return `    <SubClassOf>
        <Class abbreviatedIRI="${pname(label)}"/>
        <${t}AllValuesFrom>
            <${t}Property abbreviatedIRI="${pname(propName)}"/>
            <${isObject(tripleConstraint.valueExpr) ? "Class" : "Datatype"} abbreviatedIRI="${type}"/>
        </${t}AllValuesFrom>
    </SubClassOf>` + (chatty ? ((lower === 0 ? '' : (`\n    <SubClassOf>
        <Class abbreviatedIRI="${pname(label)}"/>
        <${t}MinCardinality cardinality="${lower}">
            <${t}Property abbreviatedIRI="${pname(propName)}"/>
        </${t}MinCardinality>
    </SubClassOf>`)) + (upper === -1 ? '' : (`\n    <SubClassOf>
        <Class abbreviatedIRI="${pname(label)}"/>
        <${t}MaxCardinality cardinality="${upper}">
            <${t}Property abbreviatedIRI="${pname(propName)}"/>
        </${t}MaxCardinality>
    </SubClassOf>`))) : '')
          }
        )).concat(

          // subclass membership
          (shape.extends || []).map(
            superClass =>
              `    <SubClassOf>
        <Class abbreviatedIRI="${pname(label)}"/>
        <Class abbreviatedIRI="${pname(superClass)}"/>
    </SubClassOf>`
          )
        ).concat(

          // package membership if not already covered
          (shapeHierarchy.parents[label] || []).find(
            supercl =>
              options.suppressDuplicateClasses && // if some superclass appears in the same package...
              getPackage(shape) === getPackage(skipDecl(schema.shapes[supercl]))
          )
            ? [] //       ... skip that package
            : [`    <SubClassOf>
        <Class abbreviatedIRI="${pname(label)}"/>
        <Class abbreviatedIRI="${pname(getPackage(shape))}_Package"/>
    </SubClassOf>`
            ]).concat(

              // shape comments
              getComments(shape).map(
            comment =>
              `    <AnnotationAssertion>
        <AnnotationProperty abbreviatedIRI="rdfs:comment"/>
        <AbbreviatedIRI>${pname(label)}</AbbreviatedIRI>
        <Literal datatypeIRI="http://www.w3.org/1999/02/22-rdf-syntax-ns#PlainLiteral">${encodeCharData(trimMarkdown(comment))}</Literal>
    </AnnotationAssertion>`
          ),
          (chatty ? simpleTripleConstraints(shape).reduce(

            // triple constraint comments
            (comments, tripleConstraint) =>
              comments.concat(getComments(tripleConstraint).map(
                comment => `    <AnnotationAssertion>
        <AnnotationProperty abbreviatedIRI="rdfs:comment"/>
        <AbbreviatedIRI>${pname(label)}</AbbreviatedIRI>
        <Literal datatypeIRI="http://www.w3.org/1999/02/22-rdf-syntax-ns#PlainLiteral">${encodeCharData(pname(tripleConstraint.predicate) + ' - ' + trimMarkdown(comment) + '\n')}</Literal>
    </AnnotationAssertion>`
              )), []
          ) : [])
            ).join('\n')
    }

    function OWLXMLEnum (label, nodeConstraint, markup) {
      let ret = [
        `    <EquivalentClasses>
        <Class abbreviatedIRI="${pname(label)}"/>
        <ObjectOneOf>`,
        nodeConstraint.values.map(
          v => `            <NamedIndividual abbreviatedIRI="${pname(v)}"/>`
        ).join('\n'),
        `        </ObjectOneOf>
    </EquivalentClasses>`]
      let pkg = nodeConstraint.annotations.find(
        a => a.predicate === SHEXMI + 'package'
      )
      if (pkg) {
        ret.push(`    <SubClassOf>
        <Class abbreviatedIRI="${pname(label)}"/>
        <Class abbreviatedIRI="${pname(pkg.object.value)}_Package"/>
    </SubClassOf>`)
      }
      return ret.join('\n')
    }

    function OWLXMLDatatype (label, nodeConstraint, markup) {
      // if (dt.name.startsWith(XSD) ||
      //     dt.name.startsWith('http://www.w3.org/XML/1998/namespace#')) {
      //   return ''
      // }
      return [].concat(
        `    <DatatypeDefinition>
        <Datatype abbreviatedIRI="${pname(label)}"/>
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
    return md.replace(/\u001e/g, '\n').replace(/^[^ \t].*\n=+\n\n/mg, '').trim()
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
        classRecord.properties
        .filter(
          propertyRecord => propertyRecord.name !== 'realizes' /* && !(isPolymorphic(propertyRecord.name)) */
        )
        .map(
          propertyRecord => {
            let propName = propertyRecord.name
            let p = model.properties[propName]
            let use = p.sources.find(s => s.id.indexOf(classId) === 0)
            let dt = isObject(tripleConstraint.valueExpr)
              ? use.idref in model.classes ? model.classes[use.idref] : model.enums[use.idref]
              : use.idref in model.datatypes ? model.datatypes[use.idref] : { name: use.href }
            if (dt === undefined) {
              console.warn(`unresolved datatype in ShExC: xmi:id="${use.idref}" for ${classRecord.name} / ${propName}`)
              dt = {name: '.'} // replace with a ShExC wildcard to keep the schema coherent.
            }
            let card = shexCardinality(use)
            let comments = (use.comments || []).map(markup.comment)
            let aggregations = use.aggregation ? [markup.aggregation(use.aggregation)] : []
            let valueStr =
                  'referees' in dt && dt instanceof UmlParser.ClassRecord && nestInlinableStructure && inlineable(model, dt)
                  ? indent(ShExCClass(model, dt.id, markup, true), '  ')
                  : isObject(tripleConstraint.valueExpr)
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

  function simpleTripleConstraints (shape) {
    if (!('expression' in shape)) {
      return []
    }
    if (shape.expression.type === 'TripleConstraint') {
      return [ shape.expression ]
    }
    if (shape.expression.type === 'EachOf' &&
        !(shape.expression.expressions.find(
          expr => expr.type !== 'TripleConstraint'
        ))) {
          return shape.expression.expressions
        }
    throw Error('can\'t (yet) express ' + JSON.stringify(shape))
  }

  function getValueType (valueExpr) {
    return valueExpr.reference || valueExpr.datatype
  }

  function isPolymorphic (propName) {
    return predicates[propName].polymorphic || predicates[propName].commonType === null
  }

  function isObject (valueExpr) {
    let v = deref(valueExpr)
    return !(v.type === 'NodeConstraint' && (v.datatype/* !! uncomment && v.datatype !== XSD + "anyURI" */ || v.nodeKind === 'Literal'))
  }

  function deref (valueExpr) {
    if (!valueExpr) { throw Error('can\'t dereference null value expression') }
    return valueExpr.type === 'ShapeRef'
      ? schema.shapes[valueExpr.reference]
      : valueExpr
  }

  // const KnownPrefixes = [
  //   {url: XSD, prefix: 'xsd'},
  //   {url: XSD, prefix: 'xs'},
  //   {url: UMLD, prefix: 'umld'},
  //   {url: 'http://www.w3.org/XML/1998/namespace#', prefix: 'xhtml'},
  //   {url: UMLP, prefix: 'umlp'}
  // ]

  function pname (id) {
    let pair = options.prefixMap.find(
      pair => id.startsWith(pair.url)
    )
    return pair
      ? pair.prefix + ':' + id.substr(pair.url.length)
      : null
  }

  function makeHierarchy () {
    let roots = {}
    let parents = {}
    let children = {}
    let holders = {}
    return {
      add: function (parent, child) {
        if (parent in children && children[parent].indexOf(child) !== -1) {
          // already seen
          return
        }
        let target = parent in holders
          ? getNode(parent)
          : (roots[parent] = getNode(parent)) // add new parents to roots.
        let value = getNode(child)

        target[child] = value
        if (child in roots) {
          delete roots[child]
        }

        // // maintain hierarchy (direct and confusing)
        // children[parent] = children[parent].concat(child, children[child])
        // children[child].forEach(c => parents[c] = parents[c].concat(parent, parents[parent]))
        // parents[child] = parents[child].concat(parent, parents[parent])
        // parents[parent].forEach(p => children[p] = children[p].concat(child, children[child]))

        // maintain hierarchy (generic and confusing)
        updateClosure(children, parents, child, parent)
        updateClosure(parents, children, parent, child)
        function updateClosure (container, members, near, far) {
          container[far] = container[far].concat(near, container[near])
          container[near].forEach(
            n => (members[n] = members[n].concat(far, members[far]))
          )
        }

        function getNode (node) {
          if (!(node in holders)) {
            parents[node] = []
            children[node] = []
            holders[node] = {}
          }
          return holders[node]
        }
      },
      roots: roots,
      parents: parents,
      children: children
    }
  }
  makeHierarchy.test = function () {
    let t = makeHierarchy()
    t.add('B', 'C')
    t.add('C', 'D')
    t.add('F', 'G')
    t.add('E', 'F')
    t.add('D', 'E')
    t.add('A', 'B')
    t.add('G', 'H')
    console.dir(t)
  }
  function walkHierarchy (n, f, p) {
    return Object.keys(n).reduce((ret, k) => {
      return ret.concat(
        walkHierarchy(n[k], f, k),
        p ? f(k, p) : []) // outer invocation can have null parent
    }, [])
  }

}

module.exports = ShExToOwl
