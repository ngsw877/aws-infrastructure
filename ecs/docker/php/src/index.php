<?php
$title         = 'My PHP Page v4...!!';
$tableContents = [
	'APP_ENV'   => $_SERVER['APP_ENV'],
	'APP_DEBUG' => $_SERVER['APP_DEBUG'],
	'TZ'        => $_SERVER['TZ'],
	'ASSET_URL' => $_SERVER['ASSET_URL'] ?? '',
];
?>

<!DOCTYPE html>
<html lang="ja">
<head>
	<title><?php echo $title; ?></title>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<!-- Bootstrap CSS -->
	<link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css" integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T" crossorigin="anonymous">
	<style>
        .card {
            min-width: 1000px;
        }
	</style>
</head>
<body>
<div class="container d-flex align-items-start justify-content-center mt-5">
	<div class="card card-center">
		<h1 class="card-header bg-info text-white">
			<?php echo $title; ?>
		</h1>
		<div class="card-body p-5">
			<table class="table table-striped">
				<thead>
				<tr>
					<th scope="col">#</th>
					<th scope="col">環境変数名</th>
					<th scope="col">値</th>
				</tr>
				</thead>
				<tbody>
				<?php
				$index = 0;
				foreach($tableContents as $key => $value){
					echo "<tr>";
					echo "<th scope='row'>" . $index . "</th>";
					echo "<td>" . $key . "</td>";
					echo "<td>" . $value . "</td>";
					echo "</tr>";
					
					$index++;
				}
				?>
				</tbody>
			</table>
		</div>
	</div>
</div>

<!-- Bootstrap JS -->
<script src="https://code.jquery.com/jquery-3.3.1.slim.min.js" integrity="sha384-q8i/X+965DzO0rT7abK41JStQIAqVgRVzpbzo5smXKp4YfRvH+8abtTE1Pi6jizo" crossorigin="anonymous"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.7/umd/popper.min.js" integrity="sha384-UO2eT0CpHqdSJQ6hJty5KVphtPhzWj9WO1clHTMGa3JDZwrnQq4sF86dIHNDz0W1" crossorigin="anonymous"></script>
<script src="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/js/bootstrap.min.js" integrity="sha384-JjSmVgyd0p3pXB1rRibZUAYoIIy6OrQ6VrjIEaFf/nJGzIxFDsf4x0xIM+B07jRM" crossorigin="anonymous"></script>
</body>
</html>
