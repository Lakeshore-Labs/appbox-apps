package operations

import (
 "context"
 "crypto/rand"
 "database/sql"
 "encoding/hex"
 "encoding/json"
 "errors"
 "fmt"
 "strings"

 "github.com/Lakeshore-Labs/appbox/sdk"
)

type ModelSummary struct { ID string `json:"id"`; Name string `json:"name"`; Revision int64 `json:"revision"`; CreatedBy string `json:"createdBy"`; CreatedAt string `json:"createdAt"` }
type ProposalSummary struct { ID string `json:"id"`; Title string `json:"title"`; BaseRevision int64 `json:"baseRevision"`; Revision int64 `json:"revision"`; State string `json:"state"`; CreatedBy string `json:"createdBy"`; UpdatedAt string `json:"updatedAt"` }
type ModelEvent struct { ID string `json:"id"`; Change string `json:"change"`; Revision int64 `json:"revision"`; Action string `json:"action"`; Actor string `json:"actor"`; Detail string `json:"detail"`; At string `json:"at"` }
type ModelView struct { ID string `json:"id"`; Name string `json:"name"`; Revision int64 `json:"revision"`; State string `json:"state"`; Document SemanticDocument `json:"document"`; Proposals []ProposalSummary `json:"proposals"`; Events []ModelEvent `json:"events"` }
type ProposalView struct { ID string `json:"id"`; Model string `json:"model"`; BaseRevision int64 `json:"baseRevision"`; Revision int64 `json:"revision"`; Title string `json:"title"`; Reason string `json:"reason"`; State string `json:"state"`; CreatedBy string `json:"createdBy"`; UpdatedAt string `json:"updatedAt"`; Document SemanticDocument `json:"document"`; Assessment ChangeAssessment `json:"assessment"` }
func newID() string {var b [16]byte; if _,err:=rand.Read(b[:]);err!=nil{panic(err)};return hex.EncodeToString(b[:])}
func decodeDocument(text string)(SemanticDocument,error){var doc SemanticDocument;err:=json.Unmarshal([]byte(text),&doc);return normalizeDocument(doc),err}
func textRef(value string)*string{return &value}
func validKey(key string)bool{return len(key)>=8&&len(key)<=128&&!strings.ContainsAny(key," \t\n")}

// Models lists this app's shared semantic models. Draft definitions do not imply implemented business data.
//appbox:role viewer
func (App) Models(ctx context.Context)([]ModelSummary,error){rows,err:=Query(ctx).ModelList(ctx);if err!=nil{return nil,err};out:=[]ModelSummary{};for _,r:=range rows{out=append(out,ModelSummary{r.ID,r.Name,r.CurrentRevision,r.CreatedBy,r.CreatedAt})};return out,nil}

// ReadModel opens a retained model and its proposal and event history.
//appbox:role viewer
func (App) ReadModel(ctx context.Context,in struct{Model string `json:"model"`})(ModelView,error){return readModel(ctx,in.Model)}
func readModel(ctx context.Context,id string)(ModelView,error){
 q:=Query(ctx);r,err:=q.ModelFind(ctx,ModelFindParams{Model:id});if err!=nil{return ModelView{},err};doc,err:=decodeDocument(r.Document);if err!=nil{return ModelView{},err}
 out:=ModelView{ID:r.ID,Name:r.Name,Revision:r.CurrentRevision,State:r.State,Document:doc,Proposals:[]ProposalSummary{},Events:[]ModelEvent{}}
 changes,err:=q.ChangeList(ctx,ChangeListParams{Model:id});if err!=nil{return out,err};for _,c:=range changes{out.Proposals=append(out.Proposals,ProposalSummary{c.ID,c.Title,c.BaseRevision,c.Revision,c.State,c.CreatedBy,c.UpdatedAt})}
 events,err:=q.EventList(ctx,EventListParams{Model:id});if err!=nil{return out,err};for _,e:=range events{out.Events=append(out.Events,ModelEvent{e.ID,e.ChangeRef,e.Revision,e.Action,e.Actor,e.Detail,e.CreatedAt})};return out,nil
}

// CreateModel saves the proposed supply-chain vocabulary as a real draft model. It creates no operational supplier, stock or order data.
//appbox:role editor
func (*App) CreateModel(ctx context.Context,in struct{Name string `json:"name"`;RequestKey string `json:"requestKey"`})(ModelView,error){
 if !validKey(in.RequestKey){return ModelView{},errors.New("A stable request key of 8–128 characters is required.")};name:=strings.TrimSpace(in.Name);if name==""||len(name)>120{return ModelView{},errors.New("Give the model a name of 1–120 characters.")}
 q:=Query(ctx);existing,err:=q.ModelByRequest(ctx,ModelByRequestParams{RequestKey:in.RequestKey});if err==nil{v,e:=readModel(ctx,existing);if e==nil&&v.Name!=name{return ModelView{},errors.New("That request key already created a different model.")};return v,e};if !errors.Is(err,sql.ErrNoRows){return ModelView{},err}
 id:=newID();actor:=string(sdk.Actor(ctx));doc:=supplyTemplate();tx,err:=sdk.DB(ctx).BeginTx(ctx,nil);if err!=nil{return ModelView{},err};defer tx.Rollback();t:=New(tx)
 if err=t.ModelInsert(ctx,ModelInsertParams{ID:id,Name:name,RequestKey:in.RequestKey,Actor:actor});err!=nil{return ModelView{},err}
 if err=t.VersionInsert(ctx,VersionInsertParams{Model:id,Document:encoded(doc),Actor:actor});err!=nil{return ModelView{},err}
 if err=t.EventInsert(ctx,EventInsertParams{ID:newID(),Model:id,ChangeRef:"",Revision:1,Action:"model_created",Actor:actor,Detail:"Created a draft vocabulary. Owning-app implementations and consumer registrations are unverified."});err!=nil{return ModelView{},err};if err=tx.Commit();err!=nil{return ModelView{},err};return readModel(ctx,id)
}

// ReadProposal opens its exact base, current edits and computed validation and impact.
//appbox:role viewer
func (App) ReadProposal(ctx context.Context,in struct{Change string `json:"change"`})(ProposalView,error){return readProposal(ctx,in.Change)}
func readProposal(ctx context.Context,id string)(ProposalView,error){q:=Query(ctx);r,err:=q.ChangeFind(ctx,ChangeFindParams{Change:id});if err!=nil{return ProposalView{},err};doc,err:=decodeDocument(r.Document);if err!=nil{return ProposalView{},err};raw,err:=q.VersionFind(ctx,VersionFindParams{Model:r.Model,Revision:r.BaseRevision});if err!=nil{return ProposalView{},err};base,err:=decodeDocument(raw);if err!=nil{return ProposalView{},err};return ProposalView{r.ID,r.Model,r.BaseRevision,r.Revision,r.Title,r.Reason,r.State,r.CreatedBy,r.UpdatedAt,doc,assess(base,doc)},nil}

// ReadProposalRevision opens the immutable definitions, rationale and assessment for a particular history entry.
//appbox:role viewer
func (App) ReadProposalRevision(ctx context.Context,in struct{Change string `json:"change"`;Revision int64 `json:"revision"`})(ProposalView,error){
 q:=Query(ctx);r,err:=q.ChangeRevisionFind(ctx,ChangeRevisionFindParams{Change:in.Change,Revision:in.Revision});if err!=nil{return ProposalView{},err};doc,err:=decodeDocument(r.Document);if err!=nil{return ProposalView{},err};raw,err:=q.VersionFind(ctx,VersionFindParams{Model:r.Model,Revision:r.BaseRevision});if err!=nil{return ProposalView{},err};base,err:=decodeDocument(raw);if err!=nil{return ProposalView{},err};return ProposalView{r.ID,r.Model,r.BaseRevision,r.Revision,r.Title,r.Reason,r.State,r.CreatedBy,r.UpdatedAt,doc,assess(base,doc)},nil
}

// BeginProposal branches a retained model revision. The optional supplier-disruption starter is editable and remains a proposal.
//appbox:role editor
func (*App) BeginProposal(ctx context.Context,in struct{Model string `json:"model"`;BaseRevision int64 `json:"baseRevision"`;Template string `json:"template"`;RequestKey string `json:"requestKey"`})(ProposalView,error){
 if !validKey(in.RequestKey){return ProposalView{},errors.New("A stable request key is required.")};if !oneOf(in.Template,"blank","supplier-disruption"){return ProposalView{},errors.New("Choose blank or supplier-disruption.")}
 q:=Query(ctx);existing,err:=q.ChangeByRequest(ctx,ChangeByRequestParams{RequestKey:in.RequestKey});if err==nil{v,e:=readProposal(ctx,existing.ID);if e==nil&&(v.Model!=in.Model||v.BaseRevision!=in.BaseRevision||existing.Template!=in.Template){return ProposalView{},errors.New("That request key belongs to a different model revision or starter.")};return v,e};if !errors.Is(err,sql.ErrNoRows){return ProposalView{},err}
 raw,err:=q.VersionFind(ctx,VersionFindParams{Model:in.Model,Revision:in.BaseRevision});if err!=nil{return ProposalView{},err};doc,err:=decodeDocument(raw);if err!=nil{return ProposalView{},err};title:="Model change";reason:=""
 if in.Template=="supplier-disruption"{found:=false;for _,c:=range doc.Concepts{if c.ID=="Supplier"{found=true};if c.ID=="SupplierDisruption"{return ProposalView{},errors.New("This revision already defines SupplierDisruption. Start a blank change to revise it.")}};if !found{return ProposalView{},errors.New("The supplier-disruption starter requires a Supplier concept.")};doc=withDisruption(doc,"Supplier");title="Introduce supplier disruptions";reason="Represent an observed supplier interruption with an explicit interval and affected capacity, while preserving the supplier's identity."}
 id:=newID();actor:=string(sdk.Actor(ctx));tx,err:=sdk.DB(ctx).BeginTx(ctx,nil);if err!=nil{return ProposalView{},err};defer tx.Rollback();t:=New(tx)
 if err=t.ChangeInsert(ctx,ChangeInsertParams{ID:id,Model:in.Model,BaseRevision:in.BaseRevision,Title:title,Reason:reason,Document:encoded(doc),RequestKey:in.RequestKey,Actor:actor,Template:in.Template});err!=nil{return ProposalView{},err}
 if err=t.ChangeSnapshot(ctx,ChangeSnapshotParams{Change:textRef(id),Actor:textRef(actor)});err!=nil{return ProposalView{},err}
 if err=t.EventInsert(ctx,EventInsertParams{ID:newID(),Model:in.Model,ChangeRef:id,Revision:1,Action:"proposal_created",Actor:actor,Detail:title});err!=nil{return ProposalView{},err};if err=tx.Commit();err!=nil{return ProposalView{},err};return readProposal(ctx,id)
}

// SaveProposal stores edits with an expected revision. Invalid drafts may be saved, but cannot be submitted.
//appbox:role editor
func (*App) SaveProposal(ctx context.Context,in struct{Change string `json:"change"`;ExpectedRevision int64 `json:"expectedRevision"`;Title string `json:"title"`;Reason string `json:"reason"`;Document SemanticDocument `json:"document"`})(ProposalView,error){
 if strings.TrimSpace(in.Title)==""||len(in.Title)>160{return ProposalView{},errors.New("A change title of 1–160 characters is required.")};body:=encoded(normalizeDocument(in.Document));if len(body)>1000000{return ProposalView{},errors.New("The draft is too large for this authoring slice.")}
 r,err:=Query(ctx).ChangeFind(ctx,ChangeFindParams{Change:in.Change});if err!=nil{return ProposalView{},err};tx,err:=sdk.DB(ctx).BeginTx(ctx,nil);if err!=nil{return ProposalView{},err};defer tx.Rollback();t:=New(tx)
 if err=t.ChangeSnapshot(ctx,ChangeSnapshotParams{Change:textRef(in.Change),Actor:textRef(string(sdk.Actor(ctx)))});err!=nil{return ProposalView{},err}
 n,err:=t.ChangeSave(ctx,ChangeSaveParams{Change:in.Change,ExpectedRevision:in.ExpectedRevision,Title:strings.TrimSpace(in.Title),Reason:in.Reason,Document:body});if err!=nil{return ProposalView{},err};if n!=1{return ProposalView{},errors.New("This proposal changed or is under review. Reload its current version; your unsaved edits have not been applied.")}
 if err=t.ChangeSnapshot(ctx,ChangeSnapshotParams{Change:textRef(in.Change),Actor:textRef(string(sdk.Actor(ctx)))});err!=nil{return ProposalView{},err}
 if err=t.EventInsert(ctx,EventInsertParams{ID:newID(),Model:r.Model,ChangeRef:r.ID,Revision:in.ExpectedRevision+1,Action:"proposal_saved",Actor:string(sdk.Actor(ctx)),Detail:in.Title});err!=nil{return ProposalView{},err};if err=tx.Commit();err!=nil{return ProposalView{},err};return readProposal(ctx,in.Change)
}

// CheckDocument computes validation, an exact semantic diff and registered-consumer impact without changing saved state.
//appbox:role editor
func (*App) CheckDocument(ctx context.Context,in struct{Model string `json:"model"`;BaseRevision int64 `json:"baseRevision"`;Document SemanticDocument `json:"document"`})(ChangeAssessment,error){raw,err:=Query(ctx).VersionFind(ctx,VersionFindParams{Model:in.Model,Revision:in.BaseRevision});if err!=nil{return ChangeAssessment{},err};base,err:=decodeDocument(raw);if err!=nil{return ChangeAssessment{},err};return assess(base,in.Document),nil}

// SubmitProposal freezes the saved revision for design review after semantic validation. It does not activate a model.
//appbox:role editor
func (*App) SubmitProposal(ctx context.Context,in struct{Change string `json:"change"`;ExpectedRevision int64 `json:"expectedRevision"`})(ProposalView,error){
 p,err:=readProposal(ctx,in.Change);if err!=nil{return p,err};if p.Revision!=in.ExpectedRevision{return p,errors.New("The proposal changed. Reload the exact revision before submitting.")};if strings.TrimSpace(p.Reason)==""{return p,errors.New("Explain why this model change is needed before requesting review.")};if !p.Assessment.CanSubmit{return p,errors.New("Resolve validation errors and make at least one semantic change before review.")}
 tx,err:=sdk.DB(ctx).BeginTx(ctx,nil);if err!=nil{return p,err};defer tx.Rollback();t:=New(tx);if err=t.ChangeSnapshot(ctx,ChangeSnapshotParams{Change:textRef(in.Change),Actor:textRef(string(sdk.Actor(ctx)))});err!=nil{return p,err};n,err:=t.ChangeSubmit(ctx,ChangeSubmitParams{Change:in.Change,ExpectedRevision:in.ExpectedRevision});if err!=nil{return p,err};if n!=1{return p,errors.New("The proposal changed or was already submitted. Reload the latest revision.")}
 if err=t.ChangeSnapshot(ctx,ChangeSnapshotParams{Change:textRef(in.Change),Actor:textRef(string(sdk.Actor(ctx)))});err!=nil{return p,err}
 if err=t.EventInsert(ctx,EventInsertParams{ID:newID(),Model:p.Model,ChangeRef:p.ID,Revision:in.ExpectedRevision+1,Action:"design_review_requested",Actor:string(sdk.Actor(ctx)),Detail:p.Reason});err!=nil{return p,err};if err=tx.Commit();err!=nil{return p,err};return readProposal(ctx,in.Change)
}

// ReviewProposal records a non-author's design decision. Acceptance is separate from runtime activation.
//appbox:role editor
func (*App) ReviewProposal(ctx context.Context,in struct{Change string `json:"change"`;ExpectedRevision int64 `json:"expectedRevision"`;Decision string `json:"decision"`;Reason string `json:"reason"`})(ProposalView,error){
 p,err:=readProposal(ctx,in.Change);if err!=nil{return p,err};if p.Revision!=in.ExpectedRevision{return p,errors.New("The proposal changed. Reload the exact revision before reviewing.")};if !oneOf(in.Decision,"design_accepted","changes_requested")||strings.TrimSpace(in.Reason)==""{return p,errors.New("Choose a design decision and explain it.")};actor:=string(sdk.Actor(ctx));contributed,err:=Query(ctx).ChangeContributed(ctx,ChangeContributedParams{Change:in.Change,Actor:actor});if err!=nil{return p,err};if p.CreatedBy==actor||contributed{return p,errors.New("An author, editor or requester cannot review their own change.")}
 tx,err:=sdk.DB(ctx).BeginTx(ctx,nil);if err!=nil{return p,err};defer tx.Rollback();t:=New(tx);if err=t.ChangeSnapshot(ctx,ChangeSnapshotParams{Change:textRef(in.Change),Actor:textRef(actor)});err!=nil{return p,err};n,err:=t.ChangeReview(ctx,ChangeReviewParams{Change:in.Change,ExpectedRevision:in.ExpectedRevision,State:in.Decision,Actor:actor});if err!=nil{return p,err};if n!=1{return p,errors.New("The proposal changed or is not awaiting review. Reload its current revision.")}
 if err=t.ChangeSnapshot(ctx,ChangeSnapshotParams{Change:textRef(in.Change),Actor:textRef(string(sdk.Actor(ctx)))});err!=nil{return p,err}
 if err=t.EventInsert(ctx,EventInsertParams{ID:newID(),Model:p.Model,ChangeRef:p.ID,Revision:in.ExpectedRevision+1,Action:in.Decision,Actor:actor,Detail:in.Reason});err!=nil{return p,err};if err=tx.Commit();err!=nil{return p,err};return readProposal(ctx,in.Change)
}

type ContractCheck struct{Name string `json:"name"`;Passed bool `json:"passed"`;Detail string `json:"detail"`}
// ContractChecks executes focused semantic checks against the same functions used by saved proposals. It changes no records.
//appbox:role viewer
func (App) ContractChecks(ctx context.Context)([]ContractCheck,error){
 base:=supplyTemplate();out:=[]ContractCheck{};check:=func(name string,passed bool,detail string){out=append(out,ContractCheck{name,passed,detail})}
 a:=assess(base,base);check("valid baseline",len(a.Issues)==0&&!a.CanSubmit,"An unchanged valid model is not a reviewable change.")
 bad,_:=decodeDocument(encoded(base));bad.Relationships[0].To="Missing";check("dangling relationship",len(assess(base,bad).Issues)>0,"Unknown targets must be rejected.")
 bad,_=decodeDocument(encoded(base));bad.Concepts[1].Aliases=[]string{"Supplier"};check("ambiguous business term",len(assess(base,bad).Issues)>0,"An alias cannot silently redefine another concept.")
 bad,_=decodeDocument(encoded(base));bad.Concepts[4].Properties[1].Unit="";check("missing quantity unit",len(assess(base,bad).Issues)>0,"Numeric properties require an explicit unit.")
 bad,_=decodeDocument(encoded(base));bad.Concepts[4].Properties[1].Unit="kg";breaking:=false;for _,d:=range assess(base,bad).Deltas{if d.Impact=="Breaking"{breaking=true}};check("unit compatibility",breaking,"A unit change is a breaking contract change.")
 extension:=withDisruption(base,"Supplier");a=assess(base,extension);planning,scenarios:=false,false;for _,c:=range a.Consumers{planning=planning||c.App=="supplyplanning";scenarios=scenarios||c.App=="supplyscenarios"};check("extension impact",a.CanSubmit&&planning&&scenarios&&!a.CanActivate,"The supplier extension identifies its declared consumers and cannot pretend to be activated.")
 bad,_=decodeDocument(encoded(extension));i:=len(bad.Concepts)-1;bad.Concepts[i].Properties[1].After="endsAt";a=assess(base,bad);cycle:=false;for _,issue:=range a.Issues{cycle=cycle||issue.Code=="date_order_cycle"};check("two-date ordering cycle",cycle&&!a.CanSubmit,"A start-after-end/end-after-start cycle is impossible.")
 bad.Concepts[i].Properties=append(bad.Concepts[i].Properties,prop("middleAt","Middle at","timestamp","","Intermediate event.",false));bad.Concepts[i].Properties[1].After="middleAt";bad.Concepts[i].Properties[4].After="endsAt";a=assess(base,bad);cycle=false;for _,issue:=range a.Issues{cycle=cycle||issue.Code=="date_order_cycle"};check("longer ordering cycle",cycle&&!a.CanSubmit,"Three-property ordering cycles must also be rejected.")
 bad,_=decodeDocument(encoded(base));bad.Relationships[0].Definition="A revised sourcing meaning.";bad.Relationships[0].Inverse="has a supplying party";bad.Relationships[0].Temporal=false;a=assess(base,bad);meaning,inverse,temporal:=false,false,false;for _,d:=range a.Deltas{meaning=meaning||(d.Path=="Relationship / supplies / meaning"&&d.Before==base.Relationships[0].Definition&&d.After==bad.Relationships[0].Definition);inverse=inverse||(d.Path=="Relationship / supplies / inverse name"&&d.After==bad.Relationships[0].Inverse);temporal=temporal||(d.Path=="Relationship / supplies / time dependent"&&d.Impact=="Breaking")};check("complete relationship diff",meaning&&inverse&&temporal,"Meaning, inverse names and temporal changes must be individually visible.")
 a=assess(base,extension);complete:=false;for _,d:=range a.Deltas{complete=complete||(d.Path=="SupplierDisruption"&&strings.Contains(d.After,"availableCapacity")&&strings.Contains(d.After,"minimum")&&strings.Contains(d.After,"startsAt"))};check("complete new-concept diff",complete,"A new concept's identity, properties, constraints and meaning must be shown.")
 bad,_=decodeDocument(encoded(base));bad.Concepts[0].Definition+=" Revised.";bad.Consumers[0].Concepts=[]string{"Plant"};a=assess(base,bad);retained:=false;for _,c:=range a.Consumers{if c.ID=="planning"{for _,id:=range c.BeforeConcepts{retained=retained||id=="Supplier"}}};check("retained prior dependency",retained,"Removing a reference in the same proposal cannot conceal its previous dependency.")
 bad,_=decodeDocument(encoded(base));bad.Consumers=bad.Consumers[1:];a=assess(base,bad);removed:=false;for _,c:=range a.Consumers{removed=removed||(c.ID=="planning"&&len(c.BeforeConcepts)>0&&len(c.AfterConcepts)==0)};check("registration-only removal impact",removed&&a.CanSubmit,"A removed registration remains in impact even without a concept edit.")
 empty,err:=decodeDocument(`{"concepts":null,"relationships":null,"consumers":null}`);check("null document collections",err==nil&&empty.Concepts!=nil&&empty.Relationships!=nil&&empty.Consumers!=nil&&!assess(base,empty).CanSubmit,"An incomplete draft stays renderable and validation explains its missing meaning.")
 bad,_=decodeDocument(encoded(base));bad.Concepts[0].Aliases=nil;bad.Concepts[0].Properties=nil;bad.Consumers[0].Concepts=nil;fixed:=normalizeDocument(bad);check("null nested collections",fixed.Concepts[0].Aliases!=nil&&fixed.Concepts[0].Properties!=nil&&fixed.Consumers[0].Concepts!=nil&&bad.Concepts[0].Properties==nil,"Nested collections normalize without mutating the caller's document.")
 for _,c:=range out{if !c.Passed{return out,fmt.Errorf("semantic contract check failed: %s",c.Name)}};return out,nil
}
