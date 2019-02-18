## Status

The current schema was derived directly from the names of classes and property in DDI-4 UML.
We are starting on bindings to some popular RDF vocabularies like DCAT and schema.org.
We hope that these bindings with work with the UML-derived schema, i.e. that the models will have the same associativity between entities.

## Model Manipulation
* eliminate *realizes* properties.
* eliminate all classes and enumerations nested in packages ending in "Pattern".
* map DDI-specific primitive datatypes to XSD datatypes.

## Nesting

The UML model captures a graph topology as a set of labeled classes, each with a list of properties.
Some classes are used for only one property in one class.
In ShEx, these can be defined as in-line shapes; ShEx renderers can represent those where they are used.
For instance, in DDI/UML, a `ConceptSystemIndicator` is used only for the `ConceptSystem`'s *contains* property.
In ShEx, this would look like (see [in situ single reference](https://github.com/ericprud/XMItoRDF/blob/modular/site/DDI_4-DR0.2.shex#L2209-L2210)):
```
ddi:ConceptSystem CLOSED EXTENDS @ddi:AnnotatedIdentifiable {
  ...
  ddi:contains @ddi:ConceptIndicator *
  ...
}
```
With nesting, single-reference shapes like `ddi:ConceptIndicator` can be expressed inline a la (see [in situ nested reference](https://github.com/ericprud/XMItoRDF/blob/modular/site/DDI_4-DR0.2-nested.shex#L909-L914)):
```
ddi:ConceptSystem CLOSED EXTENDS @ddi:AnnotatedIdentifiable {
  ...
  ddi:contains CLOSED {
    ddi:index xsd:integer *
    // shexmi:comment """Index value of member in an ordered array""";
    ddi:member @ddi:Concept *
    // shexmi:comment """Restricts member target class to Concept or subtype of Concept""";
  } *
  ...
}
```
This can be rendered as a nested tree:
<table class="shapeExpr"><tbody>
  <tr><td><a class="native" href="#ConceptSystem">ConceptSystem</a></td><td><span class="extends up">⇩</span><a href="#AnnotatedIdentifiable" class="extends up"><a class="native" href="#AnnotatedIdentifiable">AnnotatedIdentifiable</a></a></td><td></td></tr>
  <tr><td>├<span class="arrows">▻</span><a class="native">...</a></td><td></td><td></td></tr>
  <tr><td>├<span class="arrows">▻</span><a class="native" href="#contains" title="MemberIndicator Allows for the identification of the member and optionally provides an index for the member within an ordered array">contains</a></td><td></td><td>*</td></tr>
  <!-- tr class="annotation"><td class="lines">│&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;</td><td class="comment">Index value of member in an ordered array</td></tr -->
  <tr><td>│&nbsp;&nbsp;&nbsp;├<span class="arrows">▭</span><a class="native" href="#index" title="Index value of member in an ordered array">index</a></td><td><span class="pname"><span class="prefix">xsd:</span><span class="localname">integer</span></span></td><td>?</td></tr>
  <!-- tr class="annotation"><td class="lines">│&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;</td><td class="comment">Restricts member target class to Concept or subtype of Concept</td></tr -->
  <tr><td>│&nbsp;&nbsp;&nbsp;└<span class="arrows">▻</span><a class="native" href="#member" title="Restricts member target class to Concept or subtype of Concept">member</a></td><td><a class="native" href="#Concept">Concept</a></td><td></td></tr>
  <tr><td>└<span class="arrows">▻</span><a class="native">...</a></td><td></td><td></td></tr>
</tbody></table>

The [build script](https://github.com/ericprud/XMItoRDF/blob/modular/site/ddiPSM#L163) maintains a [list of nestable shapes](https://github.com/ericprud/XMItoRDF/blob/modular/site/DDI_4-DR0.2-nested.list#L102-L105).

