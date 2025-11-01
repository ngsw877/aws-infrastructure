<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Post;
use Illuminate\Http\Request;

class LikeController extends Controller
{
    public function toggle(Post $post, Request $request)
    {
        $user = $request->user();

        $like = $user->likes()->where('post_id', $post->id)->first();

        if ($like) {
            // Unlike
            $like->delete();
            $liked = false;
        } else {
            // Like
            $user->likes()->create([
                'post_id' => $post->id,
            ]);
            $liked = true;
        }

        $post->loadCount('likes');

        return response()->json([
            'liked' => $liked,
            'likes_count' => $post->likes_count,
        ]);
    }
}
