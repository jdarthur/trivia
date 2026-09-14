package rounds

import (
	"reflect"
	"testing"

	"github.com/jdarthur/trivia/models"
)

// Ticket #281: the editor owns the order of a round's questions, so an update
// replaces the list verbatim instead of merging into the stored order.
func TestMergeAdoptsQuestionOrder(t *testing.T) {
	e := &Env{}

	for _, tc := range []struct {
		name     string
		existing []string
		update   []string
		want     []string
	}{
		{
			name:     "reorders existing questions",
			existing: []string{"q1", "q2", "q3", "q4"},
			update:   []string{"q3", "q4", "q1", "q2"},
			want:     []string{"q3", "q4", "q1", "q2"},
		},
		{
			name:     "adds at the position the editor sent them",
			existing: []string{"q1", "q2"},
			update:   []string{"q3", "q1", "q2"},
			want:     []string{"q3", "q1", "q2"},
		},
		{
			name:     "drops questions missing from the update",
			existing: []string{"q1", "q2", "q3"},
			update:   []string{"q3", "q1"},
			want:     []string{"q3", "q1"},
		},
		{
			name:     "an empty list clears the round",
			existing: []string{"q1", "q2"},
			update:   []string{},
			want:     []string{},
		},
		{
			name:     "an absent list leaves the round alone",
			existing: []string{"q1", "q2"},
			update:   nil,
			want:     []string{"q1", "q2"},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			original := models.Round{
				Name:      "R",
				Questions: tc.existing,
				Wagers:    []int{1, 2, 3, 4},
			}
			update := models.Round{Name: "R", Questions: tc.update, Wagers: []int{10, 20, 30, 40}}

			e.merge(&update, &original)

			if len(original.Questions) != len(tc.want) {
				t.Fatalf("questions after merge = %v, want %v", original.Questions, tc.want)
			}
			for i, id := range tc.want {
				if original.Questions[i] != id {
					t.Fatalf("questions after merge = %v, want %v", original.Questions, tc.want)
				}
			}
		})
	}
}

// Wagers are positional (one per question), so an update replaces them too;
// only a request that omits them keeps the stored list.
func TestMergeWagers(t *testing.T) {
	e := &Env{}

	original := models.Round{Questions: []string{"q1", "q2"}, Wagers: []int{1, 2}}
	e.merge(&models.Round{Questions: []string{"q2", "q1"}, Wagers: []int{5, 6}}, &original)
	if want := []int{5, 6}; !reflect.DeepEqual(original.Wagers, want) {
		t.Fatalf("wagers = %v, want %v", original.Wagers, want)
	}

	original = models.Round{Questions: []string{"q1", "q2"}, Wagers: []int{1, 2}}
	e.merge(&models.Round{Name: "renamed"}, &original)
	if want := []int{1, 2}; !reflect.DeepEqual(original.Wagers, want) {
		t.Fatalf("wagers after an absent update = %v, want %v", original.Wagers, want)
	}
}
