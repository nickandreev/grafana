package models

import (
	"encoding/binary"
	"errors"
	"fmt"
	"hash/fnv"
	"slices"
	"unsafe"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/common/model"
)

// NotificationSettings represents the settings for notifications and used to automatically
// generate routes that uniquely match a rule to which the setting are assigned
type NotificationSettings struct {
	Receiver string `json:"receiver"`

	GroupBy           []string        `json:"group_by,omitempty"`
	GroupWait         *model.Duration `json:"group_wait,omitempty"`
	GroupInterval     *model.Duration `json:"group_interval,omitempty"`
	RepeatInterval    *model.Duration `json:"repeat_interval,omitempty"`
	MuteTimeIntervals []string        `json:"mute_time_intervals,omitempty"`
}

// Validate checks if the NotificationSettings object is valid.
// It returns an error if any of the validation checks fail.
// The receiver must be specified.
// If GroupBy is not empty, it must contain both model.AlertNameLabel and FolderTitleLabel or the special label '...'.
// GroupWait, GroupInterval, RepeatInterval must be positive durations.
func (s *NotificationSettings) Validate() error {
	if s.Receiver == "" {
		return errors.New("receiver must be specified")
	}
	if len(s.GroupBy) > 0 {
		alertName, folderTitle := false, false
		for _, lbl := range s.GroupBy {
			if lbl == "..." {
				alertName, folderTitle = true, true
				break
			}
			if lbl == model.AlertNameLabel {
				alertName = true
			}
			if lbl == FolderTitleLabel {
				folderTitle = true
			}
		}
		if !alertName || !folderTitle {
			return fmt.Errorf("group by override must contain two required labels: '%s' and '%s' or '...' (group by all)", model.AlertNameLabel, FolderTitleLabel)
		}
	}
	if s.GroupWait != nil && *s.GroupWait < 0 {
		return errors.New("group wait must be a positive duration")
	}
	if s.GroupInterval != nil && *s.GroupInterval < 0 {
		return errors.New("group interval must be a positive duration")
	}
	if s.RepeatInterval != nil && *s.RepeatInterval < 0 {
		return errors.New("repeat interval must be a positive duration")
	}
	return nil
}

// ToLabels converts the NotificationSettings object into a data.Labels object.
// It sets the AutogeneratedRouteLabel to "true" and AutogeneratedRouteReceiverNameLabel to the Receiver value of the NotificationSettings.
// If the NotificationSettings are not all default, it also sets the AutogeneratedRouteSettingsHashLabel to the string representation of the Fingerprint.
// Returns the data.Labels object.
func (s *NotificationSettings) ToLabels() data.Labels {
	result := make(data.Labels, 3)
	result[AutogeneratedRouteLabel] = "true"
	result[AutogeneratedRouteReceiverNameLabel] = s.Receiver
	if !s.IsAllDefault() {
		result[AutogeneratedRouteSettingsHashLabel] = s.Fingerprint().String()
	}
	return result
}

func (s *NotificationSettings) Equals(other *NotificationSettings) bool {
	durationEqual := func(d1, d2 *model.Duration) bool {
		if d1 == nil || d2 == nil {
			return d1 == d2
		}
		return *d1 == *d2
	}
	if s == nil || other == nil {
		return s == nil && other == nil
	}
	if s.Receiver != other.Receiver {
		return false
	}
	if !durationEqual(s.GroupWait, other.GroupWait) {
		return false
	}
	if !durationEqual(s.GroupInterval, other.GroupInterval) {
		return false
	}
	if !durationEqual(s.RepeatInterval, other.RepeatInterval) {
		return false
	}
	if !slices.Equal(s.MuteTimeIntervals, other.MuteTimeIntervals) {
		return false
	}
	sGr := s.GroupBy
	oGr := other.GroupBy
	return slices.Equal(sGr, oGr)
}

// IsAllDefault checks if the NotificationSettings object has all default values for optional fields (all except Receiver) .
func (s *NotificationSettings) IsAllDefault() bool {
	return len(s.GroupBy) == 0 && s.GroupWait == nil && s.GroupInterval == nil && s.RepeatInterval == nil && len(s.MuteTimeIntervals) == 0
}

// Fingerprint calculates a hash value based on the NotificationSettings object.
// The hash is calculated by concatenating the strings and durations of the NotificationSettings attributes
// and using an invalid UTF-8 sequence as a separator. The field GroupBy is normalized to the consistent canonical form.
// The resulting hash value is returned as a data.Fingerprint.
func (s *NotificationSettings) Fingerprint() data.Fingerprint {
	h := fnv.New64()
	tmp := make([]byte, 8)

	writeString := func(s string) {
		// save on extra slice allocation when string is converted to bytes.
		_, _ = h.Write(unsafe.Slice(unsafe.StringData(s), len(s))) //nolint:gosec
		// ignore errors returned by Write method because fnv never returns them.
		_, _ = h.Write([]byte{255}) // use an invalid utf-8 sequence as separator
	}
	writeDuration := func(d *model.Duration) {
		if d == nil {
			_, _ = h.Write([]byte{255})
		} else {
			binary.LittleEndian.PutUint64(tmp, uint64(*d))
			_, _ = h.Write(tmp)
			_, _ = h.Write([]byte{255})
		}
	}

	writeString(s.Receiver)
	for _, gb := range s.GroupBy {
		writeString(gb)
	}
	writeDuration(s.GroupWait)
	writeDuration(s.GroupInterval)
	writeDuration(s.RepeatInterval)
	for _, interval := range s.MuteTimeIntervals {
		writeString(interval)
	}
	return data.Fingerprint(h.Sum64())
}