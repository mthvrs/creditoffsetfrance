#!/usr/bin/env python3
import os
import re
import shutil
import json
from datetime import datetime
from collections import defaultdict

class ColumnNameConverter:
    def __init__(self, base_path=".", backup_dir="BACKUP_NAMING_FIX"):
        self.base_path = base_path
        self.backup_dir = backup_dir
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.full_backup_path = os.path.join(base_path, f"{backup_dir}_{self.timestamp}")
        
        # Comprehensive mapping: camelCase/flat → snake_case
        self.mappings = {
            # Movies table
            'releaseDate': 'release_date',
            'releasedate': 'release_date',
            'originalTitle': 'original_title',
            'originaltitle': 'original_title',
            'cplTitleDate': 'cpl_title_date',
            'cpltitledate': 'cpl_title_date',
            'posterPath': 'poster_path',
            'posterpath': 'poster_path',
            'createdAt': 'created_at',
            'createdat': 'created_at',
            'updatedAt': 'updated_at',
            'updatedat': 'updated_at',
            
            # Submissions table
            'movieId': 'movie_id',
            'movieid': 'movie_id',
            'cplTitle': 'cpl_title',
            'cpltitle': 'cpl_title',
            'sourceOther': 'source_other',
            'sourceother': 'source_other',
            'submitterIp': 'submitter_ip',
            'submitterip': 'submitter_ip',
            
            # Post-credit scenes
            'postCreditScenes': 'post_credit_scenes',
            'postcreditscenes': 'post_credit_scenes',
            'sceneOrder': 'scene_order',
            'sceneorder': 'scene_order',
            'startTime': 'start_time',
            'starttime': 'start_time',
            'endTime': 'end_time',
            'endtime': 'end_time',
            
            # Comments table
            'commentId': 'comment_id',
            'commentid': 'comment_id',
            'commentText': 'comment_text',
            'commenttext': 'comment_text',
            
            # Generic columns
            'submissionId': 'submission_id',
            'submissionid': 'submission_id',
            'voteType': 'vote_type',
            'votetype': 'vote_type',
            'ipAddress': 'ip_address',
            'ipaddress': 'ip_address',
            'passwordHash': 'password_hash',
            'passwordhash': 'password_hash',
            'reportType': 'report_type',
            'reporttype': 'report_type',
            'entityId': 'entity_id',
            'entityid': 'entity_id',
            'bannedBy': 'banned_by',
            'bannedby': 'banned_by',
            'likeCount': 'like_count',
            'likecount': 'like_count',
            'dislikeCount': 'dislike_count',
            'dislikecount': 'dislike_count',
            'commentCount': 'comment_count',
            'commentcount': 'comment_count',
            'userLiked': 'user_liked',
            'userliked': 'user_liked',
            'userDisliked': 'user_disliked',
            'userdisliked': 'user_disliked',
            'userVote': 'user_vote',
            'uservote': 'user_vote',
            'lastUpdate': 'last_update',
            'lastupdate': 'last_update',
            'tmdbId': 'tmdb_id',
            'tmdbid': 'tmdb_id',
            'includeAdult': 'include_adult',
        }
        
        self.stats = defaultdict(int)
        self.files_modified = []
        self.changes_by_file = defaultdict(list)
    
    def create_backup(self):
        """Create complete backup before modifications"""
        if not os.path.exists(self.base_path):
            print(f"❌ ERROR: Path not found: {self.base_path}")
            return False
        
        try:
            shutil.copytree(
                self.base_path,
                self.full_backup_path,
                ignore=shutil.ignore_patterns('node_modules', '.git', 'BACKUP_*', 'logs')
            )
            size_mb = self._get_dir_size(self.full_backup_path) / 1024 / 1024
            print(f"✅ Backup created: {self.full_backup_path}")
            print(f"   Size: {size_mb:.2f} MB")
            return True
        except Exception as e:
            print(f"❌ Backup failed: {e}")
            return False
    
    def _get_dir_size(self, path):
        total = 0
        try:
            for entry in os.scandir(path):
                if entry.is_file():
                    total += entry.stat().st_size
                elif entry.is_dir():
                    total += self._get_dir_size(entry.path)
        except:
            pass
        return total
    
    def convert_file(self, filepath):
        """Convert single file and return list of changes"""
        changes = []
        
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
        except Exception as e:
            return changes
        
        original_content = content
        
        # Sort by length descending to avoid partial replacements
        sorted_mappings = sorted(self.mappings.items(), key=lambda x: len(x[0]), reverse=True)
        
        for camel_case, snake_case in sorted_mappings:
            if camel_case == snake_case:
                continue
            
            # Patterns for different contexts
            patterns = [
                # SQL table.column (m.releaseDate → m.release_date)
                (rf'(\w+)\.{re.escape(camel_case)}\b', rf'\1.{snake_case}'),
                # SQL quoted strings ("releaseDate" → "release_date")
                (rf'["\']({re.escape(camel_case)})["\']', rf'"{snake_case}"'),
                # JavaScript object properties
                (rf'\.{re.escape(camel_case)}\b', f'.{snake_case}'),
                # Word boundary matches
                (rf'\b{re.escape(camel_case)}\b', snake_case),
            ]
            
            for pattern, replacement in patterns:
                new_content = re.sub(pattern, replacement, content)
                if new_content != content:
                    count = len(re.findall(pattern, content))
                    changes.append({
                        'from': camel_case,
                        'to': snake_case,
                        'count': count
                    })
                    content = new_content
                    self.stats[camel_case] += count
        
        if content != original_content:
            try:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
                self.files_modified.append(filepath)
                self.changes_by_file[filepath] = changes
            except Exception as e:
                print(f"⚠️  Write failed: {filepath} - {e}")
        
        return changes
    
    def process_directory(self, extensions=['.js', '.jsx']):
        """Process all code files"""
        print(f"\n📂 Processing: {self.base_path}")
        total_files = 0
        files_changed = 0
        
        for root, dirs, files in os.walk(self.base_path):
            dirs[:] = [d for d in dirs if d not in ['node_modules', '.git'] 
                       and not d.startswith('BACKUP_')]
            
            for file in files:
                if any(file.endswith(ext) for ext in extensions):
                    total_files += 1
                    filepath = os.path.join(root, file)
                    rel_path = os.path.relpath(filepath, self.base_path)
                    
                    changes = self.convert_file(filepath)
                    if changes:
                        files_changed += 1
                        print(f"\n  ✏️  {rel_path}")
                        for change in changes:
                            print(f"      {change['from']:20} → {change['to']:20} ({change['count']} occurrences)")
        
        return total_files, files_changed
    
    def generate_report(self):
        """Generate JSON report of all changes"""
        report = {
            'timestamp': self.timestamp,
            'backup_location': self.full_backup_path,
            'total_files_modified': len(self.changes_by_file),
            'total_replacements': sum(self.stats.values()),
            'changes_summary': dict(self.stats),
        }
        
        report_path = os.path.join(self.base_path, f"NAMING_FIX_REPORT_{self.timestamp}.json")
        
        try:
            with open(report_path, 'w') as f:
                json.dump(report, f, indent=2)
            print(f"\n📋 Report: {report_path}")
        except:
            pass
        
        return report

# Main execution
if __name__ == "__main__":
    print("=" * 80)
    print("CREDITOFFSET FRANCE - DATABASE NAMING CONVENTION FIX")
    print("=" * 80)
    
    converter = ColumnNameConverter(base_path=".")
    
    # Step 1: Create backup
    print("\n[1/4] Creating backup...")
    if not converter.create_backup():
        exit(1)
    
    # Step 2: Process files
    print("\n[2/4] Converting files...")
    total, changed = converter.process_directory()
    print(f"\n✅ Processed {total} files, modified {changed} files")
    
    # Step 3: Generate report
    print("\n[3/4] Generating report...")
    report = converter.generate_report()
    
    # Step 4: Summary
    print("\n[4/4] Summary:")
    print(f"   Total replacements: {report['total_replacements']}")
    print(f"   Files modified: {report['total_files_modified']}")
    print(f"\n✅ Conversion complete!")
    print(f"\n📌 ROLLBACK: Delete all modified files and restore from:")
    print(f"   {converter.full_backup_path}")
    print("=" * 80)
