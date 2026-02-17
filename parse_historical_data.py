#!/usr/bin/env python3
import re
import json
from html.parser import HTMLParser

class LegacyDataParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.movies = []
        self.current_movie = {}
        self.current_tag = None
        self.in_title = False
        self.in_year = False
        self.in_precos = False
        self.in_cos = False
        self.current_row = []
        
    def handle_starttag(self, tag, attrs):
        self.current_tag = tag
        attrs_dict = dict(attrs)
        
        if tag == 'tr':
            self.current_row = []
        elif 'class' in attrs_dict:
            if 'show-title' in attrs_dict['class']:
                self.in_title = True
            elif 'show-year' in attrs_dict['class']:
                self.in_year = True
    
    def handle_data(self, data):
        data = data.strip()
        if not data or data == '\r\n':
            return
            
        if self.in_title:
            self.current_movie['title'] = data
            self.in_title = False
        elif self.in_year:
            # Extract year from (YYYY)
            match = re.search(r'\((\d{4})\)', data)
            if match:
                self.current_movie['year'] = match.group(1)
            self.in_year = False
        elif self.current_tag == 'td' and 'title' in self.current_movie:
            # This is either pre-cos or cos
            # Check if it looks like a time (MM:SS or HH:MM:SS)
            if re.match(r'^\d{1,2}:\d{2}(:\d{2})?$', data):
                self.current_row.append(data)
    
    def handle_endtag(self, tag):
        if tag == 'tr' and self.current_movie:
            # Process the row
            if 'title' in self.current_movie:
                # current_row contains the times in order they appeared
                if len(self.current_row) == 1:
                    # Only COS
                    self.current_movie['cos'] = self.current_row[0]
                    self.current_movie['pre_cos'] = None
                elif len(self.current_row) == 2:
                    # Both present - need to figure out order
                    # In the HTML, Pre-COS column comes before COS column
                    # But sometimes pre-cos is empty and cos has value
                    # Let's check the structure more carefully
                    self.current_movie['pre_cos'] = self.current_row[0] if self.current_row[0] else None
                    self.current_movie['cos'] = self.current_row[1] if self.current_row[1] else None
                
                # Only add if we have at least a COS
                if 'cos' in self.current_movie and self.current_movie['cos']:
                    # Normalize time format to H:MM:SS or HH:MM:SS
                    if self.current_movie['cos'] and ':' in self.current_movie['cos']:
                        parts = self.current_movie['cos'].split(':')
                        if len(parts) == 2:  # MM:SS
                            self.current_movie['cos'] = f"0:{parts[0]}:{parts[1]}"
                    
                    if self.current_movie.get('pre_cos') and ':' in self.current_movie['pre_cos']:
                        parts = self.current_movie['pre_cos'].split(':')
                        if len(parts) == 2:  # MM:SS
                            self.current_movie['pre_cos'] = f"0:{parts[0]}:{parts[1]}"
                    
                    self.movies.append(self.current_movie.copy())
                
                self.current_movie = {}
                self.current_row = []
        
        self.current_tag = None

def parse_html_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    parser = LegacyDataParser()
    parser.feed(html_content)
    return parser.movies

def main():
    print("Parsing legacy data from paste.txt...")
    movies = parse_html_file('paste.txt')
    
    print(f"Found {len(movies)} movies")
    
    # Save to JSON
    output_file = 'frontend/public/legacy_data.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(movies, f, ensure_ascii=False, indent=2)
    
    print(f"Saved to {output_file}")
    
    # Print first 5 as sample
    print("\nSample (first 5):")
    for movie in movies[:5]:
        print(f"  - {movie['title']} ({movie.get('year', 'N/A')})")
        print(f"    Pre-COS: {movie.get('pre_cos', 'N/A')}, COS: {movie.get('cos', 'N/A')}")

if __name__ == '__main__':
    main()
