package main

import "testing"

func TestListenOnLoopback(t *testing.T) {
	cases := []struct {
		name string
		addr string
		want bool
	}{
		{"default all-interfaces", ":8080", false},
		{"explicit wildcard", "0.0.0.0:8080", false},
		{"ipv4 any", "0.0.0.0", false},
		{"loopback ipv4", "127.0.0.1:8080", true},
		{"localhost", "localhost:8080", true},
		{"loopback ipv6", "[::1]:8080", true},
		{"private lan ip", "192.168.8.147:8080", false},
		{"public ip", "8.8.8.8:8080", false},
		{"bare port (no colon)", "8080", false},
		{"empty", "", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := listenOnLoopback(tc.addr); got != tc.want {
				t.Errorf("listenOnLoopback(%q) = %v, want %v", tc.addr, got, tc.want)
			}
		})
	}
}
