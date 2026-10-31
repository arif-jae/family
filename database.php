<?php
declare(strict_types=1);
function database(): PDO {
    $db = new PDO('sqlite:'.__DIR__.'/storage/family.sqlite', null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    $db->exec('PRAGMA busy_timeout=5000');
    $db->exec('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    if (!in_array('national_id', array_column($db->query('PRAGMA table_info(users)')->fetchAll(), 'name'), true)) {
        $db->exec('ALTER TABLE users ADD COLUMN national_id TEXT');
    }
    $db->exec('CREATE UNIQUE INDEX IF NOT EXISTS users_national_id ON users(national_id)');
    $db->exec("CREATE TABLE IF NOT EXISTS family_links (id INTEGER PRIMARY KEY AUTOINCREMENT, requester_id INTEGER NOT NULL REFERENCES users(id), recipient_id INTEGER NOT NULL REFERENCES users(id), status TEXT NOT NULL DEFAULT 'pending', CHECK(requester_id<>recipient_id), UNIQUE(requester_id,recipient_id))");
    $db->exec("CREATE TABLE IF NOT EXISTS persons (id INTEGER PRIMARY KEY AUTOINCREMENT,national_id TEXT NOT NULL,first_name TEXT NOT NULL,last_name TEXT NOT NULL,nickname TEXT DEFAULT '',gender TEXT DEFAULT 'other',birth_date TEXT DEFAULT '',status TEXT DEFAULT 'living',phone TEXT DEFAULT '',address TEXT DEFAULT '',notes TEXT DEFAULT '',father_id INTEGER REFERENCES persons(id) ON DELETE SET NULL,mother_id INTEGER REFERENCES persons(id) ON DELETE SET NULL,spouse_id INTEGER REFERENCES persons(id) ON DELETE SET NULL,owner_id INTEGER REFERENCES users(id), UNIQUE(owner_id,national_id))");
    $columns = $db->query('PRAGMA table_info(persons)')->fetchAll();
    if (!in_array('owner_id', array_column($columns, 'name'), true)) {
        // Preserve legacy records without assigning private data to a public registrant.
        $db->exec('PRAGMA foreign_keys=OFF');
        $db->beginTransaction();
        try {
            $db->exec('ALTER TABLE persons ADD COLUMN owner_id INTEGER REFERENCES users(id)');
            $schema = $db->query("SELECT sql FROM sqlite_master WHERE name='persons'")->fetchColumn();
            $schema = preg_replace('/^CREATE TABLE persons/i', 'CREATE TABLE persons_new', $schema);
            $schema = str_replace('national_id TEXT NOT NULL UNIQUE', 'national_id TEXT NOT NULL', $schema);
            $schema = substr(rtrim($schema), 0, -1).', UNIQUE(owner_id,national_id))';
            $db->exec($schema);
            $db->exec('INSERT INTO persons_new SELECT * FROM persons');
            $db->exec('DROP TABLE persons');
            $db->exec('ALTER TABLE persons_new RENAME TO persons');
            $db->commit();
        } catch (Throwable $e) { $db->rollBack(); throw $e; }
    }
    if (!in_array('death_date', array_column($db->query('PRAGMA table_info(persons)')->fetchAll(), 'name'), true)) {
        $db->exec("ALTER TABLE persons ADD COLUMN death_date TEXT NOT NULL DEFAULT ''");
    }
    if (!in_array('photo_version', array_column($db->query('PRAGMA table_info(persons)')->fetchAll(), 'name'), true)) {
        $db->exec("ALTER TABLE persons ADD COLUMN photo_version TEXT NOT NULL DEFAULT ''");
    }
    $db->exec('PRAGMA foreign_keys=ON');
    $db->exec('CREATE TABLE IF NOT EXISTS person_photos (person_id INTEGER PRIMARY KEY REFERENCES persons(id) ON DELETE CASCADE, mime TEXT NOT NULL, content BLOB NOT NULL)');
    return $db;
}
function current_user(PDO $db): ?array {
    $stmt = $db->prepare('SELECT id,name,email,national_id FROM users WHERE id=?');
    $stmt->execute([$_SESSION['user_id']??0]);
    return $stmt->fetch() ?: null;
}
function visible_people(PDO $db, int $owner): array {
    // Follow actual family edges and matching identities across accounts, without approval.
    // UNION deduplicates visited IDs and terminates even if imported records contain cycles.
    $stmt = $db->prepare("WITH RECURSIVE connected(id) AS (
        SELECT id FROM persons WHERE owner_id=? OR national_id=(SELECT national_id FROM users WHERE id=?)
        UNION
        SELECT next.id FROM connected c JOIN persons p ON p.id=c.id JOIN persons next ON
          next.national_id=p.national_id OR next.id=p.father_id OR next.id=p.mother_id OR next.id=p.spouse_id
          OR next.father_id=p.id OR next.mother_id=p.id OR next.spouse_id=p.id
    ) SELECT p.* FROM persons p JOIN connected c ON c.id=p.id ORDER BY CASE WHEN p.owner_id=? THEN 0 ELSE 1 END,p.id");
    $stmt->execute([$owner,$owner,$owner]);
    $rows=$stmt->fetchAll();
    $user=current_user($db);
    foreach ($rows as &$row) $row=person_permissions($row,$user);
    return $rows;
}
function person_permissions(array $person,array $user): array {
    $person['can_delete']=(int)$person['owner_id']===(int)$user['id'];
    $person['can_edit']=$person['can_delete'] || (!empty($user['national_id']) && $person['national_id']===$user['national_id']);
    return $person;
}
