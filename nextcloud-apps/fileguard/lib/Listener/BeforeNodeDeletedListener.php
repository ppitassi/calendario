<?php

declare(strict_types=1);

namespace OCA\FileGuard\Listener;

use OCP\EventDispatcher\Event;
use OCP\EventDispatcher\IEventListener;
use OCP\Files\Events\Node\BeforeNodeDeletedEvent;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\ForbiddenException;

/**
 * File     -> bloqueia sempre
 * Folder   -> bloqueia se tiver conteúdo; permite se estiver vazia
 */
class BeforeNodeDeletedListener implements IEventListener {
	public function handle(Event $event): void {
		if (!($event instanceof BeforeNodeDeletedEvent)) {
			return;
		}

		$node = $event->getNode();

		if ($node instanceof File) {
			throw new ForbiddenException('Exclusão de arquivos não é permitida.', false);
		}

		if ($node instanceof Folder && count($node->getDirectoryListing()) > 0) {
			throw new ForbiddenException('Não é permitido excluir diretórios com arquivos.', false);
		}
	}
}
