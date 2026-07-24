const mysql = require('mysql2');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const databaseUrl = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const dbHost = databaseUrl?.hostname || process.env.DB_HOST || 'localhost';
const dbPort = Number(databaseUrl?.port || process.env.DB_PORT || 3306);
const dbUser = databaseUrl ? decodeURIComponent(databaseUrl.username) : process.env.DB_USER || 'root';
const dbPassword = databaseUrl ? decodeURIComponent(databaseUrl.password) : process.env.DB_PASSWORD || '';
const dbName = databaseUrl ? decodeURIComponent(databaseUrl.pathname.replace(/^\//, '')) : process.env.DB_NAME || 'content_planner';
const sslEnabled = process.env.DB_SSL_MODE === 'required' || databaseUrl?.searchParams.get('ssl-mode') === 'REQUIRED';
const sslCa = process.env.DB_SSL_CA_BASE64 ? Buffer.from(process.env.DB_SSL_CA_BASE64, 'base64').toString('utf8') : undefined;

console.log('🔄 Conectando ao host MySQL...');

// Conexão inicial sem banco de dados para poder criá-lo
const connection = mysql.createConnection({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: databaseUrl ? dbName : undefined,
    ssl: sslEnabled ? {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
        ...(sslCa ? { ca: sslCa } : {})
    } : undefined
});

connection.connect(err => {
    if (err) {
        console.error('❌ Erro ao conectar ao MySQL:', err.message);
        process.exit(1);
    }

    if (databaseUrl) {
        console.log(`Conectado ao banco gerenciado "${dbName}". Sincronizando schema...`);
        runSchemaSync();
        return;
    }

    console.log(`%c Conectado ao MySQL. Garantindo que a database "${dbName}" existe...`, 'color: green');

    connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``, (err) => {
        if (err) {
            console.error('❌ Erro ao criar database:', err.message);
            connection.end();
            process.exit(1);
        }

        console.log(`✅ Database "${dbName}" pronta. Sincronizando schema...`);
        
        // Mudar para o banco de dados criado
        connection.query(`USE \`${dbName}\``, (err) => {
            if (err) {
                console.error('❌ Erro ao selecionar database:', err.message);
                connection.end();
                process.exit(1);
            }

            runSchemaSync();
        });
    });
});

function runSchemaSync() {
    const tableQueries = [
        `CREATE TABLE IF NOT EXISTS agencies (
            id VARCHAR(50) PRIMARY KEY, 
            name VARCHAR(100) NOT NULL, 
            slogan VARCHAR(255),
            logo_url TEXT,
            logo_dark_url TEXT,
            planning_month VARCHAR(7),
            deadline VARCHAR(50),
            deadline_pre INT,
            deadline_final INT,
            theme_config JSON,
            createdAt BIGINT
        )`,
        `CREATE TABLE IF NOT EXISTS users (
            uid VARCHAR(128) PRIMARY KEY,
            email VARCHAR(255) NOT NULL,
            displayName VARCHAR(255),
            photoURL LONGTEXT,
            role VARCHAR(50) DEFAULT 'designer',
            tenant_id VARCHAR(50) DEFAULT 'default_agency',
            password VARCHAR(255),
            session_token VARCHAR(255),
            session_expires_at DATETIME,
            session_started_at DATETIME,
            last_activity_at DATETIME,
            foreground_seconds BIGINT DEFAULT 0,
            last_ip VARCHAR(64),
            last_location TEXT,
            whatsapp VARCHAR(50),
            clientId VARCHAR(50),
            birthday VARCHAR(50),
            ui_preferences JSON
        )`,
        `CREATE TABLE IF NOT EXISTS user_dashboard_layouts (
            id VARCHAR(128) PRIMARY KEY,
            tenantId VARCHAR(50) NOT NULL,
            userId VARCHAR(128) NOT NULL,
            layoutVersion INT DEFAULT 1,
            schemaVersion INT DEFAULT 1,
            layoutJson JSON NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY idx_tenant_user (tenantId, userId)
        )`,
        `CREATE TABLE IF NOT EXISTS clients (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            logoUrl TEXT,
            owners TEXT,
            socialLinks TEXT,
            instagramStats TEXT,
            config TEXT,
            createdAt BIGINT,
            tenant_id VARCHAR(50) DEFAULT 'default_agency',
            hasPreCalendar BOOLEAN DEFAULT FALSE,
            whatsappGroupId VARCHAR(100),
            meta_access_token TEXT,
            meta_account_id VARCHAR(100),
            youtube_token TEXT,
            youtube_channel_id VARCHAR(100),
            tiktok_token TEXT,
            tiktok_username VARCHAR(100),
            linkedin_token TEXT,
            linkedin_org_id VARCHAR(100),
            x_token TEXT,
            x_username VARCHAR(100),
            segment TEXT,
            voiceTone TEXT,
            targetAudience TEXT,
            contentColumns TEXT,
            brandNotes TEXT,
            postFrequency VARCHAR(255),
            networks TEXT,
            visualInfo TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS posts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            clientId VARCHAR(50),
            date DATE NOT NULL,
            type VARCHAR(50) DEFAULT 'feed',
            head TEXT,
            subhead TEXT,
            subtitle TEXT,
            objective TEXT,
            channel VARCHAR(80),
            title TEXT,
            centralIdea TEXT,
            caption TEXT,
            artHeadline TEXT,
            artText TEXT,
            cta TEXT,
            hashtags TEXT,
            visualBriefing TEXT,
            internalNotes TEXT,
            theme TEXT,
            script TEXT,
            feedImages TEXT,
            funnelStage VARCHAR(50) DEFAULT 'topo',
            status VARCHAR(50) DEFAULT 'planejado',
            tenant_id VARCHAR(50) DEFAULT 'default_agency',
            deadline DATETIME,
            assigneeId VARCHAR(128),
            UNIQUE KEY unique_client_date (clientId, date),
            FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS approval_tokens (
            id VARCHAR(100) PRIMARY KEY,
            clientId VARCHAR(50),
            month VARCHAR(7), 
            status VARCHAR(20) DEFAULT 'pending',
            expiresAt DATETIME,
            createdAt BIGINT,
            tenant_id VARCHAR(50) DEFAULT 'default_agency',
            clientNote TEXT,
            FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS custom_roles (
            id VARCHAR(50) PRIMARY KEY,
            label VARCHAR(255) NOT NULL,
            permissions TEXT NOT NULL,
            tenant_id VARCHAR(50) DEFAULT 'default_agency'
        )`,
        `CREATE TABLE IF NOT EXISTS settings (
            id VARCHAR(50) PRIMARY KEY,
            data LONGTEXT
        )`,
        `CREATE TABLE IF NOT EXISTS oauth_integration_states (
            state_hash VARCHAR(64) PRIMARY KEY,
            provider VARCHAR(32) NOT NULL,
            tenant_id VARCHAR(191) NOT NULL,
            user_uid VARCHAR(191) NOT NULL,
            client_id VARCHAR(191) NOT NULL,
            return_origin VARCHAR(500) NOT NULL,
            expires_at DATETIME NOT NULL,
            used_at DATETIME NULL,
            INDEX idx_oauth_integration_expiry (expires_at)
        )`,
        `CREATE TABLE IF NOT EXISTS social_connections (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            tenant_id VARCHAR(191) NOT NULL,
            client_id VARCHAR(191) NOT NULL,
            provider VARCHAR(32) NOT NULL,
            external_account_id VARCHAR(191) NOT NULL,
            account_name VARCHAR(255),
            access_token_encrypted LONGTEXT NOT NULL,
            token_expires_at DATETIME,
            scopes TEXT,
            page_id VARCHAR(191),
            linked_account_id VARCHAR(191),
            metadata_json LONGTEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_social_connection (tenant_id, provider, external_account_id),
            INDEX idx_social_connection_client (tenant_id, client_id, provider)
        )`,
        `CREATE TABLE IF NOT EXISTS client_analytics (
            id INT AUTO_INCREMENT PRIMARY KEY,
            clientId VARCHAR(50) NOT NULL,
            date DATE NOT NULL,
            platform VARCHAR(50) NOT NULL,
            followers INT DEFAULT 0,
            following INT DEFAULT 0,
            postsCount INT DEFAULT 0,
            reach INT DEFAULT 0,
            impressions INT DEFAULT 0,
            engagementRate FLOAT DEFAULT 0.0,
            likes INT DEFAULT 0,
            views INT DEFAULT 0,
            UNIQUE KEY unique_client_date_platform (clientId, date, platform),
            FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS post_analytics (
            postId INT PRIMARY KEY,
            likes INT DEFAULT 0,
            comments INT DEFAULT 0,
            shares INT DEFAULT 0,
            views INT DEFAULT 0,
            reach INT DEFAULT 0,
            impressions INT DEFAULT 0,
            engagementRate FLOAT DEFAULT 0.0,
            FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS post_comments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            postId INT NOT NULL,
            authorName VARCHAR(255) NOT NULL,
            authorRole VARCHAR(50) NOT NULL,
            content TEXT NOT NULL,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS upload_intents (
            id VARCHAR(64) PRIMARY KEY,
            tenant_id VARCHAR(50) NOT NULL,
            user_uid VARCHAR(128) NOT NULL,
            client_id VARCHAR(50) NOT NULL,
            remote_path TEXT NOT NULL,
            stored_name VARCHAR(255) NOT NULL,
            mime_type VARCHAR(100) NOT NULL,
            size_bytes BIGINT NOT NULL,
            upload_share_id VARCHAR(100) NOT NULL,
            final_url TEXT,
            expires_at DATETIME NOT NULL,
            finalized_at DATETIME,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_upload_intent_owner (tenant_id, user_uid),
            INDEX idx_upload_intent_expiry (expires_at)
        )`,
        `CREATE TABLE IF NOT EXISTS media_assets (
            id VARCHAR(64) PRIMARY KEY,
            tenantId VARCHAR(50) NOT NULL,
            clientId VARCHAR(50) NULL,
            ownerType VARCHAR(50) NOT NULL,
            ownerId VARCHAR(128) NOT NULL,
            category VARCHAR(50) NOT NULL,
            storageProvider VARCHAR(50) NOT NULL,
            storageKey TEXT NOT NULL,
            publicUrl TEXT NULL,
            mimeType VARCHAR(100) NOT NULL,
            sizeBytes BIGINT NOT NULL,
            width INT NULL,
            height INT NULL,
            originalName VARCHAR(255) NOT NULL,
            checksum VARCHAR(128) NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'active',
            createdBy VARCHAR(128) NOT NULL,
            createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            deletedAt DATETIME NULL,
            INDEX idx_media_asset_owner (tenantId, ownerType, ownerId),
            INDEX idx_media_asset_client (tenantId, clientId),
            INDEX idx_media_asset_status (tenantId, status, deletedAt)
        )`,
        `CREATE TABLE IF NOT EXISTS deadline_alert_log (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            tenant_id VARCHAR(50) NOT NULL,
            alert_date DATE NOT NULL,
            alert_kind VARCHAR(20) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_tenant_alert (tenant_id, alert_date, alert_kind)
        )`,
        `CREATE TABLE IF NOT EXISTS rate_limits (
            bucket_key VARCHAR(191) PRIMARY KEY,
            hit_count INT NOT NULL DEFAULT 1,
            reset_at DATETIME NOT NULL,
            INDEX idx_rate_limit_reset (reset_at)
        )`
    ];

    let index = 0;
    
    function executeTables() {
        if (index >= tableQueries.length) {
            console.log('✅ Tabelas criadas/verificadas com sucesso!');
            runColumnSync();
            return;
        }

        connection.query(tableQueries[index], (err) => {
            if (err) {
                console.error(`❌ Erro ao criar tabela no índice ${index}:`, err.message);
                connection.end();
                process.exit(1);
            }
            index++;
            executeTables();
        });
    }

    executeTables();
}

function runColumnSync() {
    const columnsToSync = [
        { table: 'users', column: 'session_expires_at', definition: 'DATETIME' },
        { table: 'users', column: 'session_started_at', definition: 'DATETIME' },
        { table: 'users', column: 'last_activity_at', definition: 'DATETIME' },
        { table: 'users', column: 'foreground_seconds', definition: 'BIGINT DEFAULT 0' },
        { table: 'users', column: 'last_ip', definition: 'VARCHAR(64)' },
        { table: 'users', column: 'last_location', definition: 'TEXT' },
        { table: 'users', column: 'ui_preferences', definition: 'JSON' },
        { table: 'clients', column: 'segment', definition: 'TEXT' },
        { table: 'clients', column: 'voiceTone', definition: 'TEXT' },
        { table: 'clients', column: 'targetAudience', definition: 'TEXT' },
        { table: 'clients', column: 'contentColumns', definition: 'TEXT' },
        { table: 'clients', column: 'brandNotes', definition: 'TEXT' },
        { table: 'clients', column: 'postFrequency', definition: 'VARCHAR(255)' },
        { table: 'clients', column: 'networks', definition: 'TEXT' },
        { table: 'clients', column: 'visualInfo', definition: 'TEXT' },
        { table: 'clients', column: 'youtube_token', definition: 'TEXT' },
        { table: 'clients', column: 'youtube_channel_id', definition: 'VARCHAR(100)' },
        { table: 'clients', column: 'tiktok_token', definition: 'TEXT' },
        { table: 'clients', column: 'tiktok_username', definition: 'VARCHAR(100)' },
        { table: 'clients', column: 'linkedin_token', definition: 'TEXT' },
        { table: 'clients', column: 'linkedin_org_id', definition: 'VARCHAR(100)' },
        { table: 'clients', column: 'x_token', definition: 'TEXT' },
        { table: 'clients', column: 'x_username', definition: 'VARCHAR(100)' },
        
        { table: 'posts', column: 'channel', definition: 'VARCHAR(80)' },
        { table: 'posts', column: 'title', definition: 'TEXT' },
        { table: 'posts', column: 'centralIdea', definition: 'TEXT' },
        { table: 'posts', column: 'caption', definition: 'TEXT' },
        { table: 'posts', column: 'artHeadline', definition: 'TEXT' },
        { table: 'posts', column: 'artText', definition: 'TEXT' },
        { table: 'posts', column: 'cta', definition: 'TEXT' },
        { table: 'posts', column: 'hashtags', definition: 'TEXT' },
        { table: 'posts', column: 'visualBriefing', definition: 'TEXT' },
        { table: 'posts', column: 'internalNotes', definition: 'TEXT' },
        { table: 'posts', column: 'subhead', definition: 'TEXT' },
        { table: 'posts', column: 'funnelStage', definition: "VARCHAR(50) DEFAULT 'topo'" },
        { table: 'posts', column: 'videoUrl', definition: 'TEXT' },
        { table: 'posts', column: 'storyImage', definition: 'TEXT' },
        { table: 'posts', column: 'coverImage', definition: 'TEXT' },
        { table: 'posts', column: 'linkedinCover', definition: 'TEXT' },
        { table: 'upload_intents', column: 'owner_type', definition: "VARCHAR(50) DEFAULT 'post'" },
        { table: 'upload_intents', column: 'owner_id', definition: 'VARCHAR(128)' },
        { table: 'upload_intents', column: 'category', definition: "VARCHAR(50) DEFAULT 'media'" },
        { table: 'upload_intents', column: 'original_name', definition: 'VARCHAR(255)' },
        
        { table: 'approval_tokens', column: 'createdAt', definition: 'BIGINT' },
        { table: 'approval_tokens', column: 'clientNote', definition: 'TEXT' }
    ];

    let index = 0;

    function syncNextColumn() {
        if (index >= columnsToSync.length) {
            console.log('✅ Colunas sincronizadas com sucesso!');
            runSeedsSync();
            return;
        }

        const { table, column, definition } = columnsToSync[index];
        const checkSql = `SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`;
        
        connection.query(checkSql, [dbName, table, column], (err, results) => {
            if (err) {
                console.error(`❌ Erro ao checar coluna ${table}.${column}:`, err.message);
                index++;
                syncNextColumn();
                return;
            }

            if (results[0].count === 0) {
                const alterSql = `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`;
                connection.query(alterSql, (alterErr) => {
                    if (alterErr) {
                        console.error(`❌ Erro ao adicionar coluna ${table}.${column}:`, alterErr.message);
                    } else {
                        console.log(`➕ Coluna adicionada: ${table}.${column}`);
                    }
                    index++;
                    syncNextColumn();
                });
            } else {
                index++;
                syncNextColumn();
            }
        });
    }

    connection.query(`ALTER TABLE posts MODIFY COLUMN type VARCHAR(50) DEFAULT 'feed'`, () => {
        connection.query(`ALTER TABLE posts MODIFY COLUMN status VARCHAR(50) DEFAULT 'planejado'`, () => {
            syncNextColumn();
        });
    });
}

function runSeedsSync() {
    const adminHashed = bcrypt.hashSync('admin', 10);
    const designerHashed = bcrypt.hashSync('designer', 10);

    const seedQueries = [
        `INSERT IGNORE INTO agencies (id, name, slogan, theme_config, createdAt) VALUES (
            'default_agency', 
            'Terceiro Andar', 
            'Estratégia Digital',
            '{"primaryColor": "#ff0000", "secondaryColor": "#000000", "logoUrl": ""}',
            ${Date.now()}
        )`,
        // Leonardo Pitassi (Admin)
        `INSERT IGNORE INTO users (uid, email, displayName, role, tenant_id, password) VALUES (
            'usr_leonardo',
            'leonardopitassi@terceiroandar.com.br',
            'Leonardo Pitassi',
            'admin',
            'default_agency',
            '${adminHashed}'
        )`,
        // Admin geral
        `INSERT IGNORE INTO users (uid, email, displayName, role, tenant_id, password) VALUES (
            'usr_admin',
            'admin@terceiroandar.com.br',
            'admin',
            'admin',
            'default_agency',
            '${adminHashed}'
        )`,
        // Designer geral
        `INSERT IGNORE INTO users (uid, email, displayName, role, tenant_id, password) VALUES (
            'usr_designer',
            'designer@terceiroandar.com.br',
            'designer',
            'designer',
            'default_agency',
            '${designerHashed}'
        )`
    ];

    let index = 0;

    function executeSeeds() {
        if (index >= seedQueries.length) {
            console.log('✅ Seeds aplicadas com sucesso!');
            console.log('🎉 Sincronização concluída com sucesso!');
            connection.end();
            return;
        }

        connection.query(seedQueries[index], (err) => {
            if (err) {
                console.error(`❌ Erro ao rodar seed ${index}:`, err.message);
            }
            index++;
            executeSeeds();
        });
    }

    executeSeeds();
}
