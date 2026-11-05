package operations

import (
 "encoding/json"
 "fmt"
 "regexp"
 "sort"
 "strings"
)

type SemanticProperty struct {
 Key string `json:"key"`
 Name string `json:"name"`
 Type string `json:"type"`
 Unit string `json:"unit"`
 Required bool `json:"required"`
 Definition string `json:"definition"`
 Minimum *float64 `json:"minimum,omitempty"`
 Maximum *float64 `json:"maximum,omitempty"`
 After string `json:"after,omitempty"`
}
type SemanticConcept struct {
 ID string `json:"id"`
 Name string `json:"name"`
 Definition string `json:"definition"`
 Owner string `json:"owner"`
 Identity string `json:"identity"`
 Aliases []string `json:"aliases"`
 Properties []SemanticProperty `json:"properties"`
}
type SemanticRelationship struct {
 ID string `json:"id"`
 Name string `json:"name"`
 From string `json:"from"`
 To string `json:"to"`
 Cardinality string `json:"cardinality"`
 Inverse string `json:"inverse"`
 Definition string `json:"definition"`
 Temporal bool `json:"temporal"`
}
type SemanticConsumer struct {
 ID string `json:"id"`
 Name string `json:"name"`
 App string `json:"app"`
 Concepts []string `json:"concepts"`
 Purpose string `json:"purpose"`
}
type SemanticDocument struct {
 Concepts []SemanticConcept `json:"concepts"`
 Relationships []SemanticRelationship `json:"relationships"`
 Consumers []SemanticConsumer `json:"consumers"`
}
type SemanticIssue struct { Code string `json:"code"`; Path string `json:"path"`; Message string `json:"message"`; Severity string `json:"severity"` }
type SemanticDelta struct { Path string `json:"path"`; Before string `json:"before"`; After string `json:"after"`; Impact string `json:"impact"` }
type ConsumerImpact struct { ID string `json:"id"`; Name string `json:"name"`; App string `json:"app"`; Concepts []string `json:"concepts"`; BeforeConcepts []string `json:"beforeConcepts"`; AfterConcepts []string `json:"afterConcepts"`; BeforeApp string `json:"beforeApp"`; AfterApp string `json:"afterApp"`; Status string `json:"status"` }
type ChangeAssessment struct {
 Issues []SemanticIssue `json:"issues"`
 Deltas []SemanticDelta `json:"deltas"`
 Consumers []ConsumerImpact `json:"consumers"`
 CanSubmit bool `json:"canSubmit"`
 CanActivate bool `json:"canActivate"`
 ActivationGates []string `json:"activationGates"`
 Coverage string `json:"coverage"`
}
var conceptID = regexp.MustCompile(`^[A-Z][A-Za-z0-9]{0,63}$`)
var propertyKey = regexp.MustCompile(`^[a-z][A-Za-z0-9]{0,63}$`)
var appName = regexp.MustCompile(`^[a-z][a-z0-9]{0,63}$`)
func normalize(s string) string { return strings.ToLower(strings.Join(strings.Fields(s)," ")) }
func oneOf(s string, values ...string) bool { for _,v:=range values {if s==v{return true}}; return false }
func encoded(v any) string { b,_:=json.Marshal(v);return string(b) }

// normalizeDocument makes API-accepted null collections safe to reopen and repair.
// It copies nested slices so assessment never changes its caller's document.
func normalizeDocument(d SemanticDocument) SemanticDocument {
 out:=SemanticDocument{Concepts:[]SemanticConcept{},Relationships:append([]SemanticRelationship{},d.Relationships...),Consumers:[]SemanticConsumer{}}
 for _,c:=range d.Concepts {c.Aliases=append([]string{},c.Aliases...);c.Properties=append([]SemanticProperty{},c.Properties...);out.Concepts=append(out.Concepts,c)}
 for _,c:=range d.Consumers {c.Concepts=append([]string{},c.Concepts...);out.Consumers=append(out.Consumers,c)}
 return out
}

func assess(base, next SemanticDocument) ChangeAssessment {
 base=normalizeDocument(base);next=normalizeDocument(next)
 out:=ChangeAssessment{Issues:[]SemanticIssue{},Deltas:[]SemanticDelta{},Consumers:[]ConsumerImpact{},ActivationGates:[]string{"Owning-app schema and operation bindings must be verified against retained builds.","Consumer compatibility and regression evidence must be attached to this exact proposal.","An eligible reviewer must accept the design; activation remains a separate action."},Coverage:"Impact includes registered consumer declarations only. These declarations describe intended dependencies; no runtime binding or regression has been verified."}
 issue:=func(code,path,message string){out.Issues=append(out.Issues,SemanticIssue{code,path,message,"error"})}
 ids:=map[string]bool{}; names:=map[string]string{}; changed:=map[string]bool{}
 if len(next.Concepts)==0 {issue("empty_model","model","Add at least one business concept.")}
 if len(next.Concepts)>100 || len(next.Relationships)>400 || len(next.Consumers)>100 {issue("model_size","model","This authoring slice supports up to 100 concepts, 400 relationships and 100 consumer declarations.")}
 for _,c:=range next.Concepts {
  path:="concepts."+c.ID
  if !conceptID.MatchString(c.ID){issue("concept_identifier",path,"Use a stable identifier starting with an uppercase letter, followed by letters or digits.")}
  if ids[c.ID]{issue("duplicate_concept",path,"Concept identifiers must be unique.")};ids[c.ID]=true
  if strings.TrimSpace(c.Name)=="" || strings.TrimSpace(c.Definition)==""{issue("concept_meaning",path,"A business name and definition are required.")}
  for _,term:=range append([]string{c.Name},c.Aliases...){key:=normalize(term);if key==""{continue};if other,ok:=names[key];ok&&other!=c.ID{issue("ambiguous_term",path,fmt.Sprintf("The term %q also names %s. Resolve the ambiguity.",term,other))};names[key]=c.ID}
  if !appName.MatchString(c.Owner){issue("owning_app",path,"Name the owning AppBox app using lowercase letters and digits.")}
  props:=map[string]SemanticProperty{}
  if len(c.Properties)>100{issue("property_count",path,"A concept may have at most 100 properties in this authoring slice.")}
  for _,p:=range c.Properties {
   pp:=path+"."+p.Key
   if !propertyKey.MatchString(p.Key){issue("property_key",pp,"Use a stable lower-camel-case property key.")}
   if _,ok:=props[p.Key];ok{issue("duplicate_property",pp,"Property keys must be unique within a concept.")};props[p.Key]=p
   if strings.TrimSpace(p.Name)==""||strings.TrimSpace(p.Definition)==""{issue("property_meaning",pp,"Give the property a name and business meaning.")}
   if !oneOf(p.Type,"text","integer","decimal","boolean","date","timestamp"){issue("property_type",pp,"Choose a supported property type.")}
   numeric:=oneOf(p.Type,"integer","decimal")
   if numeric&&strings.TrimSpace(p.Unit)==""{issue("quantity_unit",pp,"Numeric properties need an explicit unit, including ratio or each.")}
   if !numeric&&p.Unit!=""{issue("unit_type",pp,"Units belong to numeric quantities, not this property type.")}
   if (p.Minimum!=nil||p.Maximum!=nil)&&!numeric{issue("range_type",pp,"Numeric bounds require a numeric property.")}
   if p.Minimum!=nil&&p.Maximum!=nil&&*p.Minimum>*p.Maximum{issue("range_order",pp,"The minimum cannot exceed the maximum.")}
  }
  for _,p:=range c.Properties { if p.After!="" {target,found:=props[p.After];if !found||target.Type!=p.Type||!oneOf(p.Type,"date","timestamp")||p.After==p.Key{issue("date_order",path+"."+p.Key,"An after constraint must reference a different date or timestamp property of the same type.")} } }
  // Strict "after" constraints must form an acyclic ordering.
  visits:=map[string]int{};stack:=[]string{};var visit func(string)
  visit=func(key string){
   if visits[key]==2{return};if visits[key]==1{start:=0;for i,k:=range stack{if k==key{start=i;break}};cycle:=append(append([]string{},stack[start:]...),key);issue("date_order_cycle",path+"."+key,"Date ordering contains an impossible cycle: "+strings.Join(cycle," → "));return}
   p,exists:=props[key];if !exists{return};visits[key]=1;stack=append(stack,key)
   if p.After!=""{visit(p.After)};stack=stack[:len(stack)-1];visits[key]=2
  }
  for _,p:=range c.Properties{visit(p.Key)}
  identity,ok:=props[c.Identity];if !ok||!identity.Required||identity.Type!="text"{issue("identity",path,"The identity must reference a required text property.")}
 }
 relIDs:=map[string]bool{}
 for _,r:=range next.Relationships {
  path:="relationships."+r.ID
  if !propertyKey.MatchString(r.ID)||relIDs[r.ID]{issue("relationship_identifier",path,"Relationship identifiers must be unique lower-camel-case keys.")};relIDs[r.ID]=true
  if !ids[r.From]||!ids[r.To]{issue("relationship_target",path,"Both ends of the relationship must reference an existing concept.")}
  if !oneOf(r.Cardinality,"one-to-one","one-to-many","many-to-one","many-to-many"){issue("cardinality",path,"Choose an explicit relationship cardinality.")}
  if strings.TrimSpace(r.Name)==""||strings.TrimSpace(r.Inverse)==""||strings.TrimSpace(r.Definition)==""{issue("relationship_meaning",path,"Give the relationship its forward name, inverse name and business meaning.")}
 }
 consumerIDs:=map[string]bool{}
 for _,c:=range next.Consumers {
  path:="consumers."+c.ID
  if c.ID==""||consumerIDs[c.ID]{issue("consumer_identifier",path,"Consumer identifiers must be present and unique.")};consumerIDs[c.ID]=true
  if !appName.MatchString(c.App)||strings.TrimSpace(c.Name)==""||strings.TrimSpace(c.Purpose)==""{issue("consumer_meaning",path,"A consumer needs its owning app, name and intended use.")}
  for _,id:=range c.Concepts{if !ids[id]{issue("consumer_reference",path,"Unknown referenced concept: "+id)}}
 }
 add:=func(path,before,after,impact string){out.Deltas=append(out.Deltas,SemanticDelta{path,before,after,impact})}
 old:=map[string]SemanticConcept{};cur:=map[string]SemanticConcept{}
 for _,c:=range base.Concepts{old[c.ID]=c};for _,c:=range next.Concepts{cur[c.ID]=c}
 for _,c:=range next.Concepts {
  b,exists:=old[c.ID];if !exists{add(c.ID,"—",encoded(c),"Addition");changed[c.ID]=true;continue}
  if encoded(b)==encoded(c){continue};changed[c.ID]=true
  if b.Name!=c.Name{add(c.ID+" / name",b.Name,c.Name,"Meaning review")};if b.Definition!=c.Definition{add(c.ID+" / meaning",b.Definition,c.Definition,"Meaning review")}
  if b.Owner!=c.Owner{add(c.ID+" / owning app",b.Owner,c.Owner,"Contract change")};if b.Identity!=c.Identity{add(c.ID+" / identity",b.Identity,c.Identity,"Breaking")}
  if encoded(b.Aliases)!=encoded(c.Aliases){add(c.ID+" / aliases",strings.Join(b.Aliases,", "),strings.Join(c.Aliases,", "),"Meaning review")}
  bp:=map[string]SemanticProperty{};np:=map[string]SemanticProperty{};for _,p:=range b.Properties{bp[p.Key]=p};for _,p:=range c.Properties{np[p.Key]=p}
  for _,p:=range c.Properties{q,ok:=bp[p.Key];impact:="Addition";before:="—";if ok{before=encoded(q);impact="Meaning review";if q.Type!=p.Type||q.Unit!=p.Unit||(!q.Required&&p.Required)||encoded(q.Minimum)!=encoded(p.Minimum)||encoded(q.Maximum)!=encoded(p.Maximum)||q.After!=p.After{impact="Breaking"}}else if p.Required{impact="Breaking"};if !ok||encoded(q)!=encoded(p){add(c.ID+"."+p.Key,before,encoded(p),impact)}}
  for _,p:=range b.Properties{if _,ok:=np[p.Key];!ok{add(c.ID+"."+p.Key,encoded(p),"Removed","Breaking")}}
 }
 for _,b:=range base.Concepts{if _,ok:=cur[b.ID];!ok{add(b.ID,encoded(b),"Removed","Breaking");changed[b.ID]=true}}
 br:=map[string]SemanticRelationship{};nr:=map[string]SemanticRelationship{};for _,r:=range base.Relationships{br[r.ID]=r};for _,r:=range next.Relationships{nr[r.ID]=r}
 for _,r:=range next.Relationships{
  b,ok:=br[r.ID];if ok&&encoded(b)==encoded(r){continue};changed[r.From]=true;changed[r.To]=true
  path:="Relationship / "+r.ID
  if !ok{add(path,"—",encoded(r),"Addition");continue};changed[b.From]=true;changed[b.To]=true
  field:=func(label,before,after,impact string){if before!=after{add(path+" / "+label,before,after,impact)}}
  field("forward name",b.Name,r.Name,"Meaning review");field("inverse name",b.Inverse,r.Inverse,"Meaning review");field("meaning",b.Definition,r.Definition,"Meaning review")
  field("from",b.From,r.From,"Breaking");field("to",b.To,r.To,"Breaking");field("cardinality",b.Cardinality,r.Cardinality,"Breaking");field("time dependent",encoded(b.Temporal),encoded(r.Temporal),"Breaking")
 }
 for _,b:=range base.Relationships{if _,ok:=nr[b.ID];!ok{add("Relationship / "+b.ID,encoded(b),"Removed","Breaking");changed[b.From]=true;changed[b.To]=true}}
 bc:=map[string]SemanticConsumer{};nc:=map[string]SemanticConsumer{};all:=map[string]bool{}
 for _,c:=range base.Consumers{bc[c.ID]=c;all[c.ID]=true};for _,c:=range next.Consumers{nc[c.ID]=c;all[c.ID]=true}
 for id:=range all {
  before,had:=bc[id];after,has:=nc[id];registrationChanged:=!had||!has||encoded(before)!=encoded(after)
  if registrationChanged{left,right,impact:="—","Removed","Dependency registration";if had{left=encoded(before)};if has{right=encoded(after)}else{impact="Coverage reduction"};add("Consumer / "+id,left,right,impact)}
  refs:=[]string{};seen:=map[string]bool{}
  for _,ref:=range append(append([]string{},before.Concepts...),after.Concepts...){if !seen[ref]&&(changed[ref]||registrationChanged){refs=append(refs,ref);seen[ref]=true}}
  if len(refs)==0&&!registrationChanged{continue};sort.Strings(refs)
  c:=after;if !has{c=before};status:="Planned dependency · implementation unverified";if !has{status="Registration removed · previous dependencies still require review"}else if !had{status="Registration added · implementation unverified"}else if registrationChanged{status="Registration changed · previous and proposed dependencies require review"}
  out.Consumers=append(out.Consumers,ConsumerImpact{ID:id,Name:c.Name,App:c.App,Concepts:refs,BeforeConcepts:append([]string{},before.Concepts...),AfterConcepts:append([]string{},after.Concepts...),BeforeApp:before.App,AfterApp:after.App,Status:status})
 }
 sort.Slice(out.Deltas,func(i,j int)bool{return out.Deltas[i].Path<out.Deltas[j].Path})
 sort.Slice(out.Consumers,func(i,j int)bool{return out.Consumers[i].ID<out.Consumers[j].ID})
 out.CanSubmit=len(out.Issues)==0&&len(out.Deltas)>0
 return out
}

func prop(key,name,typ,unit,definition string,required bool) SemanticProperty{return SemanticProperty{Key:key,Name:name,Type:typ,Unit:unit,Required:required,Definition:definition}}
func concept(id,name,meaning string,extras ...SemanticProperty) SemanticConcept{return SemanticConcept{id,name,meaning,"supplynetwork","id",[]string{},append([]SemanticProperty{prop("id","Canonical identity","text","","Stable identity retained across source systems and consumers.",true)},extras...)}}
func supplyTemplate() SemanticDocument {
 concepts:=[]SemanticConcept{
  concept("Supplier","Supplier","A business party supplying materials. Supplier identity is distinct from a purchase document or a disruption.",prop("name","Business name","text","","The supplier's recognized business name.",true)),
  concept("Material","Material","A material definition shared by procurement, stock and planning. Quantities belong to dated positions or events, not the material master.",prop("name","Business name","text","","The material's business description.",true),prop("baseUnit","Base unit","text","","The unit code used to interpret this material's quantities.",true)),
  concept("Product","Product","A finished product linked to a governed material identity, effective BOM and customer order demand."),
  concept("BOM","Bill of materials","An effective version of a product's composition. Component quantities are recorded on its BOM items.",prop("validFrom","Valid from","timestamp","","Start of the version's effective interval.",true),prop("validTo","Valid until","timestamp","","Exclusive end of the effective interval, when known.",false)),
  concept("BOMItem","BOM item","One component requirement within a specific bill-of-materials version.",prop("quantity","Component quantity","decimal","each","Component requirement expressed in its declared quantity unit.",true)),
  concept("CustomerOrder","Customer order","A customer's commercial demand document. Individual quantities and due dates belong to order items."),
  concept("OrderItem","Customer order item","One dated product requirement on a customer order.",prop("quantity","Ordered quantity","decimal","each","Quantity of the linked product requested by the customer.",true),prop("dueAt","Due time","timestamp","","Required fulfillment time with source calendar meaning retained.",true)),
  concept("Plant","Plant","An operating location used to scope material planning and production."),
  concept("StockObservation","Stock observation","A reconciled stock quantity at a checkpoint and observation time. Already included movements must not be added again.",prop("quantity","Observed quantity","decimal","each","Measured stock in its declared unit.",true),prop("observedAt","Observed at","timestamp","","The instant this stock was observed.",true)),
  concept("MovementEvent","Movement event","A dated material movement or consumption fact, distinct from a stock observation.",prop("quantity","Moved quantity","decimal","each","Quantity transferred or consumed in its declared unit.",true),prop("occurredAt","Occurred at","timestamp","","When the movement physically occurred.",true)),
 }
 rel:=func(id,name,from,to,card,inverse,meaning string)SemanticRelationship{return SemanticRelationship{id,name,from,to,card,inverse,meaning,true}}
 return SemanticDocument{Concepts:concepts,Relationships:[]SemanticRelationship{
  rel("supplies","supplies","Supplier","Material","many-to-many","is supplied by","An effective sourcing relationship; it does not assert current availability."),
  rel("productMaterial","has material identity","Product","Material","one-to-one","identifies product","One canonical material identity for the finished product."),
  rel("productBoms","uses composition","Product","BOM","one-to-many","defines composition of","A product may have successive effective BOM versions."),
  rel("bomItems","contains requirement","BOM","BOMItem","one-to-many","belongs to BOM","A BOM item retains the identity of its owning BOM version."),
  rel("componentMaterial","requires material","BOMItem","Material","many-to-one","is required by","The BOM item supplies the quantity and unit for this component."),
  rel("orderItems","contains demand","CustomerOrder","OrderItem","one-to-many","belongs to order","Each item carries its product, quantity and due time."),
  rel("orderedProduct","requests product","OrderItem","Product","many-to-one","is requested by","The product identity reused by planning and fulfillment."),
  rel("observedMaterial","observes material","StockObservation","Material","many-to-one","has stock observation","The observation measures this material at a known checkpoint."),
  rel("movedMaterial","moves material","MovementEvent","Material","many-to-one","has movement event","Movement references the same canonical material identity."),
 },Consumers:[]SemanticConsumer{
  {"planning","Demand and coverage","supplyplanning",[]string{"Supplier","Material","Product","BOM","BOMItem","OrderItem","StockObservation","MovementEvent"},"Intended planning inputs and pegging dependencies."},
  {"costing","Activity costing","supplycosting",[]string{"Material","Product","MovementEvent"},"Intended activity and quantity interpretation for cost calculations."},
  {"scenarios","Scenario input selection","supplyscenarios",[]string{"Supplier","Material","Plant"},"Intended canonical targets for hypothetical changes."},
 }}
}
func withDisruption(base SemanticDocument, supplier string) SemanticDocument {
 c:=concept("SupplierDisruption","Supplier disruption","An observed interruption affecting one supplier during a defined interval. Hypothetical changes remain scenario assumptions.",prop("startsAt","Starts at","timestamp","","Inclusive start of the affected period.",true),prop("endsAt","Ends at","timestamp","","Exclusive end of the affected period; must follow startsAt.",true),prop("availableCapacity","Available capacity fraction","decimal","ratio","Remaining capacity relative to the normal available capacity; valid range 0 to 1.",true))
 zero,one:=0.0,1.0; c.Properties[2].After="startsAt";c.Properties[3].Minimum=&zero;c.Properties[3].Maximum=&one
 base.Concepts=append(base.Concepts,c)
 base.Relationships=append(base.Relationships,SemanticRelationship{"disruptionSupplier","affects supplier","SupplierDisruption",supplier,"many-to-one","has disruption","Each disruption identifies the affected supplier; multiple events may exist over time.",true})
 return base
}
