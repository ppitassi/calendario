# Migração do storage local

1. Pare o processo do aplicativo no PM2.
2. Configure um diretório absoluto, persistente, fora do repositório em UPLOAD_STORAGE_ROOT.
3. Garanta leitura e escrita para o mesmo usuário que executa o PM2.
4. Copie o conteúdo legado de server/uploads preservando a estrutura relativa. Não remova a origem ainda.
5. Inicie o aplicativo e confirme no log a validação do storage.
6. Verifique logos, avatares, artes, apresentações e PDFs.
7. Mantenha a origem em backup durante a janela de segurança definida pela operação.

O aplicativo não move nem exclui uploads legados automaticamente. O comando
npm run assets:backfill executa apenas o dry-run. A opção --apply registra
referências antigas de forma idempotente e
não altera os campos URL existentes.
