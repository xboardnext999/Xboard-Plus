<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('v2_subscription_transfer')) {
            return;
        }

        Schema::create('v2_subscription_transfer', function (Blueprint $table) {
            $table->integer('id', true);
            $table->integer('subscription_id')->index();
            $table->integer('from_user_id')->index();
            $table->integer('to_user_id')->index();
            $table->integer('plan_id')->nullable()->index();
            $table->integer('fee')->default(0)->comment('转让费用，单位分');
            $table->string('from_email');
            $table->string('to_email');
            $table->string('plan_name')->nullable();
            $table->integer('transferred_at')->index();
            $table->json('metadata')->nullable();
            $table->integer('created_at');
            $table->integer('updated_at');

            $table->index(['from_user_id', 'transferred_at'], 'idx_subscription_transfer_from');
            $table->index(['to_user_id', 'transferred_at'], 'idx_subscription_transfer_to');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('v2_subscription_transfer');
    }
};
