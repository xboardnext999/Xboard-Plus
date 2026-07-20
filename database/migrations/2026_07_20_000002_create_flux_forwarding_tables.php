<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('flux_nodes', function (Blueprint $table) {
            $table->id(); $table->string('name', 100); $table->string('secret', 100)->unique();
            $table->text('ip')->nullable(); $table->string('server_ip', 100); $table->unsignedInteger('port_start')->default(10000); $table->unsignedInteger('port_end')->default(60000);
            $table->string('version', 100)->nullable(); $table->boolean('allow_http')->default(false); $table->boolean('allow_tls')->default(true); $table->boolean('allow_socks')->default(false);
            $table->boolean('enabled')->default(true); $table->unsignedBigInteger('last_seen_at')->nullable(); $table->json('system_info')->nullable(); $table->timestamps();
        });
        Schema::create('flux_tunnels', function (Blueprint $table) {
            $table->id(); $table->string('name', 100); $table->foreignId('in_node_id')->constrained('flux_nodes')->cascadeOnDelete(); $table->foreignId('out_node_id')->constrained('flux_nodes')->cascadeOnDelete();
            $table->string('in_ip', 100)->nullable(); $table->string('out_ip', 100)->nullable(); $table->unsignedTinyInteger('type')->default(1); $table->string('protocol', 16)->default('tls');
            $table->unsignedTinyInteger('billing_mode')->default(2); $table->decimal('traffic_ratio', 10, 2)->default(1); $table->string('tcp_listen_addr', 100)->default('[::]'); $table->string('udp_listen_addr', 100)->default('[::]');
            $table->string('interface_name', 200)->nullable(); $table->boolean('enabled')->default(true); $table->timestamps();
        });
        Schema::create('flux_speed_limits', function (Blueprint $table) {
            $table->id(); $table->string('name', 100); $table->unsignedInteger('speed_mbps'); $table->foreignId('tunnel_id')->constrained('flux_tunnels')->cascadeOnDelete(); $table->boolean('enabled')->default(true); $table->timestamps();
        });
        Schema::create('flux_forwards', function (Blueprint $table) {
            $table->id(); $table->integer('user_id')->index(); $table->string('name', 100); $table->foreignId('tunnel_id')->constrained('flux_tunnels')->cascadeOnDelete();
            $table->unsignedInteger('in_port'); $table->unsignedInteger('out_port')->nullable(); $table->text('remote_addr'); $table->string('strategy', 32)->default('fifo'); $table->string('interface_name', 200)->nullable();
            $table->unsignedBigInteger('upload_bytes')->default(0); $table->unsignedBigInteger('download_bytes')->default(0); $table->unsignedInteger('sort')->default(0); $table->boolean('enabled')->default(true); $table->timestamps();
            $table->unique(['tunnel_id', 'in_port']);
        });
        Schema::create('flux_user_tunnels', function (Blueprint $table) {
            $table->id(); $table->integer('user_id')->index(); $table->foreignId('tunnel_id')->constrained('flux_tunnels')->cascadeOnDelete(); $table->foreignId('speed_limit_id')->nullable()->constrained('flux_speed_limits')->nullOnDelete();
            $table->unsignedInteger('forward_limit')->default(1); $table->unsignedBigInteger('traffic_limit')->default(0); $table->unsignedBigInteger('upload_bytes')->default(0); $table->unsignedBigInteger('download_bytes')->default(0);
            $table->unsignedBigInteger('reset_at')->nullable(); $table->unsignedBigInteger('expires_at')->nullable(); $table->boolean('enabled')->default(true); $table->timestamps(); $table->unique(['user_id', 'tunnel_id']);
        });
        Schema::create('flux_flow_stats', function (Blueprint $table) {
            $table->id(); $table->integer('user_id')->index(); $table->foreignId('forward_id')->nullable()->constrained('flux_forwards')->nullOnDelete();
            $table->unsignedBigInteger('bytes'); $table->unsignedBigInteger('total_bytes'); $table->date('stat_date'); $table->timestamps(); $table->index(['user_id', 'stat_date']);
        });
    }
    public function down(): void
    {
        foreach (['flux_flow_stats','flux_user_tunnels','flux_forwards','flux_speed_limits','flux_tunnels','flux_nodes'] as $table) Schema::dropIfExists($table);
    }
};
