<?php

namespace App\Http\Controllers\V2\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class FluxController extends Controller
{
    private const RESOURCES = [
        'nodes' => 'flux_nodes', 'tunnels' => 'flux_tunnels', 'forwards' => 'flux_forwards',
        'limits' => 'flux_speed_limits', 'access' => 'flux_user_tunnels', 'stats' => 'flux_flow_stats',
    ];

    public function summary()
    {
        $counts = collect(self::RESOURCES)->map(fn($table) => DB::table($table)->count());
        $traffic = DB::table('flux_forwards')->selectRaw('COALESCE(SUM(upload_bytes + download_bytes),0) total')->value('total');
        $online = DB::table('flux_nodes')->where('enabled', 1)->where('last_seen_at', '>=', time() - 180)->count();
        return ['counts' => $counts, 'online_nodes' => $online, 'traffic' => (int)$traffic,
            'recent' => DB::table('flux_flow_stats')->orderByDesc('id')->limit(20)->get()];
    }

    public function index(Request $request, string $resource)
    {
        $table = $this->table($resource); $query = DB::table($table);
        if ($keyword = trim((string)$request->input('keyword'))) {
            $columns = match ($resource) { 'nodes','tunnels','limits' => ['name'], 'forwards' => ['name','remote_addr'], default => [] };
            if ($columns) $query->where(fn($q) => collect($columns)->each(fn($c, $i) => $i ? $q->orWhere($c, 'like', "%{$keyword}%") : $q->where($c, 'like', "%{$keyword}%")));
        }
        foreach (['user_id','tunnel_id','enabled'] as $field) if ($request->filled($field) && DB::getSchemaBuilder()->hasColumn($table, $field)) $query->where($field, $request->input($field));
        $page = $query->orderByDesc($resource === 'forwards' ? 'sort' : 'id')->paginate(min(100, max(10, (int)$request->input('page_size', 30))));
        return ['data' => $page->items(), 'total' => $page->total(), 'current_page' => $page->currentPage(), 'last_page' => $page->lastPage()];
    }

    public function save(Request $request, string $resource)
    {
        $table = $this->table($resource); $id = $request->integer('id') ?: null;
        $rules = $this->rules($resource, $id); $data = $request->validate($rules);
        unset($data['id']); $now = now();
        if ($resource === 'nodes' && empty($data['secret'])) $data['secret'] = Str::random(40);
        if ($id) { $data['updated_at'] = $now; DB::table($table)->where('id', $id)->update($data); }
        else { $data['created_at'] = $now; $data['updated_at'] = $now; $id = DB::table($table)->insertGetId($data); }
        return ['id' => $id, 'data' => DB::table($table)->find($id)];
    }

    public function destroy(Request $request, string $resource)
    {
        $request->validate(['id' => 'required|integer']); DB::table($this->table($resource))->where('id', $request->integer('id'))->delete(); return ['success' => true];
    }

    public function options()
    {
        return [
            'nodes' => DB::table('flux_nodes')->select('id','name','server_ip')->orderBy('name')->get(),
            'tunnels' => DB::table('flux_tunnels')->select('id','name')->orderBy('name')->get(),
            'limits' => DB::table('flux_speed_limits')->select('id','name','speed_mbps')->orderBy('name')->get(),
            'users' => DB::table('v2_user')->select('id','email')->orderByDesc('id')->limit(1000)->get(),
        ];
    }

    private function table(string $resource): string { abort_unless(isset(self::RESOURCES[$resource]), 404); return self::RESOURCES[$resource]; }
    private function rules(string $resource, ?int $id): array
    {
        return match ($resource) {
            'nodes' => ['id'=>'nullable|integer','name'=>'required|string|max:100','secret'=>['nullable','string','max:100',Rule::unique('flux_nodes','secret')->ignore($id)],'ip'=>'nullable|string','server_ip'=>'required|string|max:100','port_start'=>'required|integer|min:1|max:65535','port_end'=>'required|integer|min:1|max:65535','version'=>'nullable|string|max:100','allow_http'=>'boolean','allow_tls'=>'boolean','allow_socks'=>'boolean','enabled'=>'boolean'],
            'tunnels' => ['id'=>'nullable|integer','name'=>'required|string|max:100','in_node_id'=>'required|exists:flux_nodes,id','out_node_id'=>'required|different:in_node_id|exists:flux_nodes,id','in_ip'=>'nullable|string|max:100','out_ip'=>'nullable|string|max:100','type'=>'required|integer|in:1,2','protocol'=>'required|in:tcp,udp,tls,ws,wss','billing_mode'=>'required|integer|in:1,2','traffic_ratio'=>'required|numeric|min:0.1|max:100','tcp_listen_addr'=>'required|string|max:100','udp_listen_addr'=>'required|string|max:100','interface_name'=>'nullable|string|max:200','enabled'=>'boolean'],
            'forwards' => ['id'=>'nullable|integer','user_id'=>'required|exists:v2_user,id','name'=>'required|string|max:100','tunnel_id'=>'required|exists:flux_tunnels,id','in_port'=>['required','integer','min:1','max:65535',Rule::unique('flux_forwards')->where(fn($q)=>$q->where('tunnel_id',request('tunnel_id')))->ignore($id)],'out_port'=>'nullable|integer|min:1|max:65535','remote_addr'=>'required|string','strategy'=>'required|in:fifo,round,random,hash','interface_name'=>'nullable|string|max:200','sort'=>'integer|min:0','enabled'=>'boolean'],
            'limits' => ['id'=>'nullable|integer','name'=>'required|string|max:100','speed_mbps'=>'required|integer|min:1|max:100000','tunnel_id'=>'required|exists:flux_tunnels,id','enabled'=>'boolean'],
            'access' => ['id'=>'nullable|integer','user_id'=>'required|exists:v2_user,id','tunnel_id'=>['required','exists:flux_tunnels,id',Rule::unique('flux_user_tunnels')->where(fn($q)=>$q->where('user_id',request('user_id')))->ignore($id)],'speed_limit_id'=>'nullable|exists:flux_speed_limits,id','forward_limit'=>'required|integer|min:0|max:100000','traffic_limit'=>'required|integer|min:0','reset_at'=>'nullable|integer','expires_at'=>'nullable|integer','enabled'=>'boolean'],
            default => abort(422, '该资源不支持编辑'),
        };
    }
}
