package operations

import "context"

// ReadModelVersion reads the exact retained model revision and its SHA-256
// definition hash. It never substitutes the current revision. RuntimeVerified
// remains false until owning-app builds and consumer compatibility are verified
// by a separate release contract; this operation does not activate anything.
//
//appbox:role viewer
func (App) ReadModelVersion(ctx context.Context, in struct {
	Model    string `json:"model"`
	Revision int64  `json:"revision"`
}) (ModelVersionView, error) {
	if err := validateModelVersionInput(in.Model, in.Revision); err != nil {
		return ModelVersionView{}, err
	}
	row, err := Query(ctx).ReadSemanticVersion(ctx, ReadSemanticVersionParams{
		Model: in.Model, Revision: in.Revision,
	})
	if err != nil {
		return ModelVersionView{}, err
	}
	return modelVersionView(row.Model, row.Revision, row.State, row.Document)
}
