<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('v2_digital_product_category', function (Blueprint $table) {
            $table->id();
            $table->string('name', 50)->unique();
            $table->boolean('enabled')->default(true)->index();
            $table->unsignedInteger('sort')->default(0)->index();
            $table->unsignedInteger('created_at')->nullable();
            $table->unsignedInteger('updated_at')->nullable();
        });
        Schema::table('v2_plan', function (Blueprint $table) {
            $table->unsignedBigInteger('digital_category_id')->nullable()->after('product_config')->index();
            $table->foreign('digital_category_id')->references('id')->on('v2_digital_product_category')->nullOnDelete();
        });

        $categories = [];
        foreach (DB::table('v2_plan')->where('product_type', 'digital')->get(['id', 'product_config']) as $plan) {
            $config = json_decode((string) $plan->product_config, true) ?: [];
            $name = trim((string) ($config['category'] ?? '数字商品')) ?: '数字商品';
            if (!isset($categories[$name])) {
                $categories[$name] = DB::table('v2_digital_product_category')->insertGetId([
                    'name' => $name, 'enabled' => true, 'sort' => count($categories) + 1,
                    'created_at' => time(), 'updated_at' => time(),
                ]);
            }
            DB::table('v2_plan')->where('id', $plan->id)->update(['digital_category_id' => $categories[$name]]);
        }
        if (!$categories) DB::table('v2_digital_product_category')->insert(['name' => '数字商品', 'enabled' => true, 'sort' => 1, 'created_at' => time(), 'updated_at' => time()]);
    }

    public function down(): void
    {
        Schema::table('v2_plan', function (Blueprint $table) {
            $table->dropForeign(['digital_category_id']);
            $table->dropColumn('digital_category_id');
        });
        Schema::dropIfExists('v2_digital_product_category');
    }
};
