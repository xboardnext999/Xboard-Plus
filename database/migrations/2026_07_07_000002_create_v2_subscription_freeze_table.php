<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('v2_subscription_freeze')) {
            return;
        }

        Schema::create('v2_subscription_freeze', function (Blueprint $table) {
            $table->integer('id', true);
            $table->integer('subscription_id')->index();
            $table->integer('user_id')->index();
            $table->integer('started_at');
            $table->integer('ended_at')->nullable();
            $table->integer('days')->default(0);
            $table->tinyInteger('status')->default(1)->index()->comment('1冻结中 2已解冻');
            $table->string('reason', 255)->nullable();
            $table->integer('created_at');
            $table->integer('updated_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('v2_subscription_freeze');
    }
};
