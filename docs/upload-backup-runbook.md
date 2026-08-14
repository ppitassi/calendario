# Backup e restauração do pipeline de uploads

## Escopo obrigatório

- Todo o conteúdo apontado por UPLOAD_STORAGE_ROOT.
- Tabela media_assets.
- Tabelas com URLs legadas: clients, agencies, users e posts.
- Tabela upload_intents apenas quando houver uploads em andamento durante a janela.

## Verificação segura

Use um diretório temporário fora do storage ativo e valide o backup sem restaurar
sobre produção:

    mysqldump --single-transaction --no-data DATABASE media_assets clients agencies users posts > schema-check.sql
    mysqlcheck --check DATABASE media_assets clients agencies users posts

Para arquivos, compare contagem, tamanho total e hashes por amostragem entre o
storage e uma cópia de restauração isolada. Nunca registre nomes de arquivos,
URLs públicas ou credenciais nos logs do job.

## Restauração

1. Pare somente a aplicação web e o worker no PM2.
2. Restaure o banco em uma instância isolada e execute as verificações de integridade.
3. Restaure os arquivos em um diretório novo, preservando as chaves relativas.
4. Aponte UPLOAD_STORAGE_ROOT para o diretório restaurado.
5. Execute npm run assets:backfill em modo dry-run.
6. Inicie os processos, valide health, imagens, apresentação e PDF.
7. Mantenha o storage anterior intacto até concluir a janela de validação.

O comando de backfill só grava quando executado explicitamente com --apply.
Use --batch-size e --resume-after para retomadas controladas.
