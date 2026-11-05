package operations

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"unicode"
)

// ModelVersionView identifies an exact retained semantic definition. Its state is
// descriptive metadata; this read does not verify an owning app or activate it.
type ModelVersionView struct {
	Model           string           `json:"model"`
	Revision        int64            `json:"revision"`
	State           string           `json:"state"`
	DefinitionHash  string           `json:"definitionHash"`
	Document        SemanticDocument `json:"document"`
	RuntimeVerified bool             `json:"runtimeVerified"`
}

func validateModelVersionInput(model string, revision int64) error {
	if model == "" || len(model) > 128 || strings.IndexFunc(model, func(r rune) bool {
		return unicode.IsSpace(r) || unicode.IsControl(r)
	}) >= 0 {
		return errors.New("A model identity of 1–128 characters without whitespace or control characters is required.")
	}
	if revision < 1 {
		return errors.New("A positive model revision is required.")
	}
	return nil
}

// semanticDefinitionHash uses SHA-256 over encoding/json's compact encoding of
// the normalized SemanticDocument. Struct field order and collection order are
// retained; null collections become empty arrays. JSON object key order and
// whitespace on input cannot change this hash. Model, revision and lifecycle
// state are outside the hashed document. This is the v1 encoding contract.
func semanticDefinitionHash(document SemanticDocument) (string, error) {
	canonical, err := json.Marshal(normalizeDocument(document))
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256(canonical)
	return "sha256:" + hex.EncodeToString(digest[:]), nil
}

func modelVersionView(model string, revision int64, state, rawDocument string) (ModelVersionView, error) {
	document, err := decodeDocument(rawDocument)
	if err != nil {
		return ModelVersionView{}, err
	}
	digest, err := semanticDefinitionHash(document)
	if err != nil {
		return ModelVersionView{}, err
	}
	return ModelVersionView{
		Model: model, Revision: revision, State: state,
		DefinitionHash: digest, Document: document, RuntimeVerified: false,
	}, nil
}
