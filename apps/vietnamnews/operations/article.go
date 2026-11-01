package operations

import (
	"context"
	"encoding/xml"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/Lakeshore-Labs/appbox/sdk"
)

type RSS struct {
	XMLName xml.Name `xml:"rss"`
	Channel Channel  `xml:"channel"`
}

type Channel struct {
	Title string    `xml:"title"`
	Items []RSSItem `xml:"item"`
}

type RSSItem struct {
	Title       string `xml:"title"`
	Link        string `xml:"link"`
	Description string `xml:"description"`
	PubDate     string `xml:"pubDate"`
	GUID        string `xml:"guid"`
}

// Finish marks the task done and answers it.
//
//appbox:role editor
func (t *Task) Finish(context.Context) (Task, error) {
	t.Done = true
	return *t, nil
}

// ToggleFeatured toggles whether an article is featured on the front page.
//
//appbox:role editor
func (a *Article) ToggleFeatured(ctx context.Context) error {
	a.IsFeatured = !a.IsFeatured
	return nil
}

// ToggleBreaking toggles whether an article is marked as breaking news.
//
//appbox:role editor
func (a *Article) ToggleBreaking(ctx context.Context) error {
	a.IsBreaking = !a.IsBreaking
	return nil
}

// FetchLiveRSSNews fetches the latest live RSS articles from Vietnam news feeds and saves new stories to the database.
//
//appbox:role editor
func (App) FetchLiveRSSNews(ctx context.Context) (int64, error) {
	feeds := []struct {
		Source string
		URL    string
	}{
		{"VnExpress International", "https://e.vnexpress.net/rss/news.rss"},
		{"VietnamPlus", "https://en.vietnamplus.vn/rss/home.rss"},
	}

	var addedCount int64 = 0
	client := &http.Client{Timeout: 10 * time.Second}

	for _, feed := range feeds {
		req, err := http.NewRequestWithContext(ctx, "GET", feed.URL, nil)
		if err != nil {
			continue
		}
		req.Header.Set("User-Agent", "AppboxVietnamNews/1.0")

		resp, err := client.Do(req)
		if err != nil || resp.StatusCode != http.StatusOK {
			if resp != nil {
				resp.Body.Close()
			}
			continue
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			continue
		}

		var rss RSS
		if err := xml.Unmarshal(body, &rss); err != nil {
			continue
		}

		for _, item := range rss.Channel.Items {
			cleanTitle := strings.TrimSpace(item.Title)
			if cleanTitle == "" {
				continue
			}

			summary := item.Description
			if idx := strings.Index(summary, "</a"); idx != -1 {
				if endIdx := strings.Index(summary[idx:], ">"); endIdx != -1 {
					summary = strings.TrimSpace(summary[idx+endIdx+1:])
				}
			}
			summary = stripHTML(summary)
			if len(summary) > 500 {
				summary = summary[:497] + "..."
			}
			if summary == "" {
				summary = cleanTitle
			}

			pubTime := time.Now()
			if t, err := time.Parse(time.RFC1123, item.PubDate); err == nil {
				pubTime = t
			} else if t, err := time.Parse(time.RFC1123Z, item.PubDate); err == nil {
				pubTime = t
			}

			res, err := sdk.DB(ctx).ExecContext(ctx,
				`INSERT INTO "app_vietnamnews"."article" (title, summary, content, source, source_url, published_at, is_featured, is_breaking, added_by)
				 SELECT $1, $2, $3, $4, $5, $6, false, false, $7
				 WHERE NOT EXISTS (SELECT 1 FROM "app_vietnamnews"."article" WHERE title = $1)`,
				cleanTitle, summary, summary, feed.Source, item.Link, pubTime, sdk.Actor(ctx),
			)
			if err == nil {
				if rows, _ := res.RowsAffected(); rows > 0 {
					addedCount += rows
				}
			}
		}
	}

	return addedCount, nil
}

func stripHTML(input string) string {
	var builder strings.Builder
	inTag := false
	for _, r := range input {
		if r == '<' {
			inTag = true
			continue
		}
		if r == '>' {
			inTag = false
			continue
		}
		if !inTag {
			builder.WriteRune(r)
		}
	}
	return strings.TrimSpace(builder.String())
}
