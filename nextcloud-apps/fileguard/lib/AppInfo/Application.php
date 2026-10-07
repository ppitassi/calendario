<?php

declare(strict_types=1);

namespace OCA\FileGuard\AppInfo;

use OCA\FileGuard\Listener\BeforeNodeDeletedListener;
use OCP\AppFramework\App;
use OCP\AppFramework\Bootstrap\IBootContext;
use OCP\AppFramework\Bootstrap\IBootstrap;
use OCP\AppFramework\Bootstrap\IRegistrationContext;
use OCP\Files\Events\Node\BeforeNodeDeletedEvent;

class Application extends App implements IBootstrap {
	public const APP_ID = 'fileguard';

	public function __construct() {
		parent::__construct(self::APP_ID);
	}

	public function register(IRegistrationContext $context): void {
		$context->registerEventListener(BeforeNodeDeletedEvent::class, BeforeNodeDeletedListener::class);
	}

	public function boot(IBootContext $context): void {
	}
}
